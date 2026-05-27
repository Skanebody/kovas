import { getCurrentUser } from '@/lib/auth/current-user'
import { QontoClient } from '@/lib/qonto/client'
import {
  getConnectorWithCredentials,
  setConnectorStatus,
  touchLastSync,
} from '@/lib/qonto/connector-store'
import { mapKovasClientToQonto } from '@/lib/qonto/mapper'
import { type KovasClientForMapping, QontoApiError } from '@/lib/qonto/types'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * POST /api/quotes/[id]/sync-qonto
 *
 * Synchronise un devis KOVAS vers Qonto.
 *
 * ⚠️ Note métier (V1) : Qonto ne propose pas d'endpoint « quotes » distinct dans
 * son API v2 publique au 2026-05. La sync devis est gérée comme une facture
 * en statut `draft` (workflow KOVAS = devis accepté → facture). En attendant
 * un endpoint dédié, on stocke uniquement la création du client Qonto et on
 * documente l'absence d'objet devis natif.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id: quoteId } = await context.params

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
    return NextResponse.json(
      {
        error: 'qonto_not_connected',
        message: 'Connectez votre compte Qonto depuis Compte → Intégrations.',
      },
      { status: 412 },
    )
  }

  const { data: quote, error: qErr } = await userSupabase
    .from('quotes')
    .select(
      'id, organization_id, client_id, reference, status, issued_at, expires_at, amount_ht, amount_tva, amount_ttc, tva_rate, line_items, qonto_quote_id, qonto_synced_at',
    )
    .eq('id', quoteId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (qErr) {
    return NextResponse.json({ error: 'db_error', detail: qErr.message }, { status: 500 })
  }
  if (!quote) {
    return NextResponse.json({ error: 'quote_not_found' }, { status: 404 })
  }

  const { data: client, error: cliErr } = await userSupabase
    .from('clients')
    .select(
      'id, type, display_name, first_name, last_name, company_name, email, address, city, postal_code, country, siret, qonto_customer_id',
    )
    .eq('id', quote.client_id)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (cliErr || !client) {
    return NextResponse.json({ error: 'client_not_found' }, { status: 404 })
  }

  const qonto = new QontoClient(conn.credentials)

  try {
    // Aligne au moins le client côté Qonto (équivalent quote → customer prêt pour conversion facture)
    let qontoCustomerId = client.qonto_customer_id as string | null
    if (!qontoCustomerId) {
      const payload = mapKovasClientToQonto(client as KovasClientForMapping)
      const created = await qonto.createClient(payload)
      qontoCustomerId = created.id

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

    // Trace la "synchro" devis (côté KOVAS uniquement, pas d'objet quote Qonto v2)
    const admin = adminClient()
    await admin
      .from('quotes')
      .update({
        qonto_quote_id: `pending:${qontoCustomerId}`,
        qonto_synced_at: new Date().toISOString(),
      })
      .eq('id', quote.id)
      .eq('organization_id', orgId)

    await touchLastSync({ orgId, provider: 'qonto' })

    return NextResponse.json({
      ok: true,
      qonto_customer_id: qontoCustomerId,
      message:
        "Client synchronisé côté Qonto. La facture sera créée à la conversion (Qonto ne dispose pas d'objet devis dédié dans son API v2).",
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
