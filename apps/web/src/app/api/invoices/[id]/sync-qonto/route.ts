import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  getConnectorWithCredentials,
  setConnectorStatus,
  touchLastSync,
} from '@/lib/qonto/connector-store'
import { QontoClient } from '@/lib/qonto/client'
import { mapKovasClientToQonto, mapKovasInvoiceToQonto } from '@/lib/qonto/mapper'
import {
  QontoApiError,
  type KovasClientForMapping,
  type KovasInvoiceForMapping,
} from '@/lib/qonto/types'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/invoices/[id]/sync-qonto
 *
 * Synchronise une facture KOVAS vers Qonto :
 *   1. Vérifie auth + connecteur Qonto actif pour l'org
 *   2. Charge facture + client (RLS appliqué via supabase user-side)
 *   3. Crée le client Qonto si pas déjà sync (sinon réutilise qonto_customer_id)
 *   4. POST /client_invoices Qonto
 *   5. Stocke qonto_invoice_id + qonto_synced_at sur la facture
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: invoiceId } = await context.params

  let orgId: string
  let userSupabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
    userSupabase = u.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 1. Connecteur Qonto actif requis (analogue addon check)
  const conn = await getConnectorWithCredentials(orgId, 'qonto')
  if (!conn || conn.row.status !== 'active') {
    return NextResponse.json(
      {
        error: 'qonto_not_connected',
        message: 'Connectez votre compte Qonto depuis Compte → Intégrations.',
      },
      { status: 412 },
    )
  }

  // 2. Charger facture + client (RLS = isolation org via user supabase)
  const { data: invoice, error: invErr } = await userSupabase
    .from('invoices')
    .select(
      'id, organization_id, client_id, reference, status, issued_at, due_date, amount_ht, amount_tva, amount_ttc, tva_rate, line_items, qonto_invoice_id, qonto_synced_at',
    )
    .eq('id', invoiceId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (invErr) {
    return NextResponse.json({ error: 'db_error', detail: invErr.message }, { status: 500 })
  }
  if (!invoice) {
    return NextResponse.json({ error: 'invoice_not_found' }, { status: 404 })
  }
  if (invoice.status === 'draft') {
    return NextResponse.json(
      { error: 'invoice_draft', message: 'Émettez la facture avant de la synchroniser.' },
      { status: 422 },
    )
  }
  if (!invoice.client_id) {
    return NextResponse.json(
      { error: 'invoice_no_client', message: 'Facture sans client (snapshot only) non syncable.' },
      { status: 422 },
    )
  }

  const { data: client, error: cliErr } = await userSupabase
    .from('clients')
    .select(
      'id, type, display_name, first_name, last_name, company_name, email, address, city, postal_code, country, siret, qonto_customer_id',
    )
    .eq('id', invoice.client_id)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (cliErr || !client) {
    return NextResponse.json({ error: 'client_not_found' }, { status: 404 })
  }

  const qonto = new QontoClient(conn.credentials)

  try {
    // 3. Créer client Qonto si manquant
    let qontoCustomerId = client.qonto_customer_id as string | null

    if (!qontoCustomerId) {
      const payload = mapKovasClientToQonto(client as KovasClientForMapping)
      const created = await qonto.createClient(payload)
      qontoCustomerId = created.id

      // Service-role update pour bypass RLS write (mêmes vérifs déjà faites côté lecture user)
      const admin = adminClient()
      await admin
        .from('clients')
        .update({
          qonto_customer_id: qontoCustomerId,
          qonto_synced_at: new Date().toISOString(),
        })
        .eq('id', client.id)
        .eq('organization_id', orgId)
    }

    // 4. Créer facture Qonto
    const invoicePayload = mapKovasInvoiceToQonto(invoice as unknown as KovasInvoiceForMapping, {
      qontoClientId: qontoCustomerId,
      reportToGovernment: false, // V1 : sync simple, pas de transmission DGFiP automatique
    })
    const createdInvoice = await qonto.createInvoice(invoicePayload)

    // 5. Stocker l'ID Qonto sur la facture
    const admin = adminClient()
    await admin
      .from('invoices')
      .update({
        qonto_invoice_id: createdInvoice.id,
        qonto_synced_at: new Date().toISOString(),
      })
      .eq('id', invoice.id)
      .eq('organization_id', orgId)

    await touchLastSync({ orgId, provider: 'qonto' })

    return NextResponse.json({
      ok: true,
      qonto_invoice_id: createdInvoice.id,
      qonto_customer_id: qontoCustomerId,
      qonto_number: createdInvoice.number,
      qonto_url: createdInvoice.invoice_url ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'sync_failed'
    const statusCode = err instanceof QontoApiError ? err.statusCode : 500

    await setConnectorStatus({
      orgId,
      provider: 'qonto',
      status: statusCode >= 500 ? 'error' : 'active',
      lastError: `[${statusCode}] ${message}`,
    })

    return NextResponse.json(
      {
        error: 'qonto_sync_failed',
        message,
        status: statusCode,
      },
      { status: statusCode >= 400 && statusCode < 600 ? statusCode : 502 },
    )
  }
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase service role manquant pour sync Qonto.')
  }
  return createSupabaseAdmin(url, key, { auth: { persistSession: false } })
}
