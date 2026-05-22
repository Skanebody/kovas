/**
 * POST /api/invoices/:id/sync-tiime
 *
 * Pousse une facture KOVAS vers Tiime.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { TiimeClient } from '@/lib/tiime/client'
import { clientToTiimeCustomer, invoiceToTiimeInvoice } from '@/lib/tiime/mapper'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_req: Request, ctx: RouteParams) {
  const { id } = await ctx.params
  const { supabase, orgId } = await getCurrentUser()

  const { data: connector } = await supabase
    .from('accounting_connectors')
    .select('status, config, oauth_access_token_encrypted, workspace_id')
    .eq('organization_id', orgId)
    .eq('provider', 'tiime')
    .maybeSingle()

  if (!connector || connector.status !== 'active') {
    return NextResponse.json(
      {
        ok: false,
        code: 'connector_inactive',
        message: 'Connecteur Tiime non configuré. Activez-le depuis Compte → Intégrations → Tiime.',
      },
      { status: 400 },
    )
  }

  const accessToken = connector.oauth_access_token_encrypted
  const companyId = connector.workspace_id
  if (!accessToken || !companyId) {
    return NextResponse.json(
      { ok: false, message: 'Identifiants Tiime incomplets (token ou workspace)' },
      { status: 400 },
    )
  }

  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select(
      'id, reference, amount_ht, amount_ttc, tva_rate, line_items, issued_at, due_date, client_id, tiime_invoice_id',
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  if (invErr || !invoice) {
    return NextResponse.json({ ok: false, message: 'Facture introuvable' }, { status: 404 })
  }

  if (invoice.tiime_invoice_id) {
    return NextResponse.json(
      { ok: true, alreadySynced: true, tiimeInvoiceId: invoice.tiime_invoice_id },
      { status: 200 },
    )
  }

  const tiime = new TiimeClient({ accessToken, companyId })

  let tiimeCustomerId: string | undefined
  if (invoice.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select(
        'display_name, email, phone, address, city, postal_code, country, siret, type, tiime_customer_id',
      )
      .eq('id', invoice.client_id)
      .eq('organization_id', orgId)
      .single()

    if (client?.tiime_customer_id) {
      tiimeCustomerId = client.tiime_customer_id
    } else if (client) {
      const customerRes = await tiime.createCustomer(clientToTiimeCustomer(client))
      if (!customerRes.ok || !customerRes.data?.id) {
        return NextResponse.json(
          { ok: false, code: 'customer_failed', message: customerRes.message },
          { status: 502 },
        )
      }
      tiimeCustomerId = customerRes.data.id
      await supabase
        .from('clients')
        .update({ tiime_customer_id: tiimeCustomerId })
        .eq('id', invoice.client_id)
    }
  }

  const tiimePayload = invoiceToTiimeInvoice(invoice, tiimeCustomerId)
  const result = await tiime.createInvoice(tiimePayload)

  if (!result.ok || !result.data?.id) {
    return NextResponse.json(
      { ok: false, code: 'invoice_failed', message: result.message },
      { status: 502 },
    )
  }

  await supabase
    .from('invoices')
    .update({ tiime_invoice_id: result.data.id, tiime_synced_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true, tiimeInvoiceId: result.data.id })
}
