import { getCurrentUser } from '@/lib/auth/current-user'
import { QontoClient } from '@/lib/qonto/client'
import {
  getConnectorWithCredentials,
  setConnectorStatus,
  touchLastSync,
} from '@/lib/qonto/connector-store'
import { mapKovasClientToQonto, mapKovasInvoiceToQonto } from '@/lib/qonto/mapper'
import {
  type KovasClientForMapping,
  type KovasInvoiceForMapping,
  QontoApiError,
} from '@/lib/qonto/types'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * POST /api/account/integrations/qonto/resync
 *
 * Rejoue la sync sur toutes les factures émises de l'organisation qui n'ont
 * pas encore d'`qonto_invoice_id`. Limité à 50 factures par appel (chunking
 * côté UI si nécessaire).
 */
export async function POST() {
  let orgId: string
  let userSupabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
    userSupabase = u.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const conn = await getConnectorWithCredentials(orgId, 'qonto')
  if (!conn || conn.row.status !== 'active') {
    return NextResponse.json({ error: 'qonto_not_connected' }, { status: 412 })
  }

  const { data: invoices, error: invErr } = await userSupabase
    .from('invoices')
    .select(
      'id, organization_id, client_id, reference, status, issued_at, due_date, amount_ht, amount_tva, amount_ttc, tva_rate, line_items, qonto_invoice_id',
    )
    .eq('organization_id', orgId)
    .neq('status', 'draft')
    .is('qonto_invoice_id', null)
    .order('issued_at', { ascending: true })
    .limit(50)

  if (invErr) {
    return NextResponse.json({ error: 'db_error', detail: invErr.message }, { status: 500 })
  }

  const list = invoices ?? []
  if (list.length === 0) {
    return NextResponse.json({ ok: true, synced: 0, total: 0 })
  }

  const qonto = new QontoClient(conn.credentials)
  const admin = adminClient()

  let synced = 0
  let lastError: string | null = null

  for (const invoice of list) {
    try {
      if (!invoice.client_id) {
        lastError = `Facture ${invoice.reference} sans client`
        continue
      }
      const { data: client } = await userSupabase
        .from('clients')
        .select(
          'id, type, display_name, first_name, last_name, company_name, email, address, city, postal_code, country, siret, qonto_customer_id',
        )
        .eq('id', invoice.client_id)
        .eq('organization_id', orgId)
        .maybeSingle()

      if (!client) {
        lastError = `Client manquant pour ${invoice.reference}`
        continue
      }

      let qontoCustomerId = client.qonto_customer_id as string | null
      if (!qontoCustomerId) {
        const created = await qonto.createClient(
          mapKovasClientToQonto(client as KovasClientForMapping),
        )
        qontoCustomerId = created.id
        await admin
          .from('clients')
          .update({
            qonto_customer_id: qontoCustomerId,
            qonto_synced_at: new Date().toISOString(),
          })
          .eq('id', client.id)
          .eq('organization_id', orgId)
      }

      const payload = mapKovasInvoiceToQonto(invoice as unknown as KovasInvoiceForMapping, {
        qontoClientId: qontoCustomerId,
      })
      const createdInvoice = await qonto.createInvoice(payload)

      await admin
        .from('invoices')
        .update({
          qonto_invoice_id: createdInvoice.id,
          qonto_synced_at: new Date().toISOString(),
        })
        .eq('id', invoice.id)
        .eq('organization_id', orgId)

      synced += 1
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'unknown'
      // 4xx Qonto sur une facture isolée → on saute, on continue
      if (err instanceof QontoApiError && err.statusCode >= 500) {
        // 5xx persistant : on arrête la boucle pour ne pas DoS Qonto
        break
      }
    }
  }

  if (lastError) {
    await setConnectorStatus({
      orgId,
      provider: 'qonto',
      status: synced > 0 ? 'active' : 'error',
      lastError,
    })
  } else {
    await touchLastSync({ orgId, provider: 'qonto' })
  }

  return NextResponse.json({
    ok: true,
    synced,
    total: list.length,
    lastError,
  })
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Supabase service role manquant pour resync Qonto.')
  }
  return createSupabaseAdmin(url, key, { auth: { persistSession: false } })
}
