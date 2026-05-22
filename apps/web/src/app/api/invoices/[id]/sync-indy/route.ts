/**
 * POST /api/invoices/:id/sync-indy
 *
 * Pousse une facture KOVAS vers Indy. Tant que l'API Indy n'est pas publique,
 * répond 501 avec un message clair et propose de créer une demande d'accès.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { IndyClient } from '@/lib/indy/client'
import { clientToIndyCustomer, invoiceToIndyInvoice } from '@/lib/indy/mapper'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_req: Request, ctx: RouteParams) {
  const { id } = await ctx.params
  const { supabase, orgId } = await getCurrentUser()

  const { data: connector } = await supabase
    .from('accounting_connectors')
    .select('status, config, api_key_encrypted')
    .eq('organization_id', orgId)
    .eq('provider', 'indy')
    .maybeSingle()

  if (!connector || connector.status !== 'active') {
    return NextResponse.json(
      {
        ok: false,
        code: 'connector_inactive',
        message: 'Connecteur Indy non configuré. Activez-le depuis Compte → Intégrations → Indy.',
      },
      { status: 400 },
    )
  }

  const { data: invoice, error: invErr } = await supabase
    .from('invoices')
    .select(
      'id, reference, amount_ht, amount_ttc, tva_rate, line_items, issued_at, due_date, client_id, indy_invoice_id',
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  if (invErr || !invoice) {
    return NextResponse.json({ ok: false, message: 'Facture introuvable' }, { status: 404 })
  }

  if (invoice.indy_invoice_id) {
    return NextResponse.json(
      { ok: true, alreadySynced: true, indyInvoiceId: invoice.indy_invoice_id },
      { status: 200 },
    )
  }

  let indyCustomerId: string | undefined
  if (invoice.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select(
        'display_name, email, phone, address, city, postal_code, country, siret, indy_customer_id',
      )
      .eq('id', invoice.client_id)
      .eq('organization_id', orgId)
      .single()

    if (client?.indy_customer_id) {
      indyCustomerId = client.indy_customer_id
    } else if (client) {
      const apiKey = connector.api_key_encrypted
      if (!apiKey) {
        return NextResponse.json({ ok: false, message: 'Clé API Indy manquante' }, { status: 400 })
      }
      const indy = new IndyClient({ apiKey })
      const customerRes = await indy.createCustomer(clientToIndyCustomer(client))
      if (!customerRes.ok || !customerRes.data?.id) {
        return NextResponse.json(
          {
            ok: false,
            code: customerRes.status === 501 ? 'api_unavailable' : 'customer_failed',
            message: customerRes.message,
          },
          { status: customerRes.status === 501 ? 501 : 502 },
        )
      }
      indyCustomerId = customerRes.data.id
      await supabase
        .from('clients')
        .update({ indy_customer_id: indyCustomerId })
        .eq('id', invoice.client_id)
    }
  }

  const apiKey = connector.api_key_encrypted
  if (!apiKey) {
    return NextResponse.json({ ok: false, message: 'Clé API Indy manquante' }, { status: 400 })
  }
  const indy = new IndyClient({ apiKey })
  const indyPayload = invoiceToIndyInvoice(invoice, indyCustomerId)
  const result = await indy.createInvoice(indyPayload)

  if (!result.ok || !result.data?.id) {
    if (result.status === 501) {
      return NextResponse.json(
        {
          ok: false,
          code: 'api_unavailable',
          message:
            "L'API Indy n'est pas encore publique. Demandez l'accès depuis Compte → Intégrations → Indy.",
        },
        { status: 501 },
      )
    }
    return NextResponse.json(
      { ok: false, code: 'invoice_failed', message: result.message },
      { status: 502 },
    )
  }

  await supabase
    .from('invoices')
    .update({ indy_invoice_id: result.data.id, indy_synced_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ ok: true, indyInvoiceId: result.data.id })
}
