/**
 * POST /api/quotes/:id/sync-tiime
 *
 * Tiime supporte les devis (`/companies/{companyId}/quotes`).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { TiimeClient } from '@/lib/tiime/client'
import { clientToTiimeCustomer } from '@/lib/tiime/mapper'
import { NextResponse } from 'next/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_req: Request, ctx: RouteParams) {
  const { id } = await ctx.params
  const { supabase, orgId } = await getCurrentUser()

  const { data: connector } = await supabase
    .from('accounting_connectors')
    .select('status, oauth_access_token_encrypted, workspace_id')
    .eq('organization_id', orgId)
    .eq('provider', 'tiime')
    .maybeSingle()

  if (!connector || connector.status !== 'active') {
    return NextResponse.json(
      {
        ok: false,
        code: 'connector_inactive',
        message: 'Connecteur Tiime non configuré.',
      },
      { status: 400 },
    )
  }

  const accessToken = connector.oauth_access_token_encrypted
  const companyId = connector.workspace_id
  if (!accessToken || !companyId) {
    return NextResponse.json(
      { ok: false, message: 'Identifiants Tiime incomplets' },
      { status: 400 },
    )
  }

  const { data: quote, error: quoteErr } = await supabase
    .from('quotes')
    .select(
      'id, reference, amount_ht, amount_ttc, tva_rate, line_items, issued_at, expires_at, client_id, tiime_quote_id',
    )
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  if (quoteErr || !quote) {
    return NextResponse.json({ ok: false, message: 'Devis introuvable' }, { status: 404 })
  }

  if (quote.tiime_quote_id) {
    return NextResponse.json(
      { ok: true, alreadySynced: true, tiimeQuoteId: quote.tiime_quote_id },
      { status: 200 },
    )
  }

  const tiime = new TiimeClient({ accessToken, companyId })

  let tiimeCustomerId: string | undefined
  if (quote.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select(
        'display_name, email, phone, address, city, postal_code, country, siret, type, tiime_customer_id',
      )
      .eq('id', quote.client_id)
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
        .eq('id', quote.client_id)
    }
  }

  // Tiime expose POST /companies/{companyId}/quotes — payload similaire aux invoices.
  const payload = {
    number: quote.reference,
    customer_id: tiimeCustomerId,
    issue_date: quote.issued_at ?? new Date().toISOString(),
    valid_until: quote.expires_at,
    total_amount_excluding_taxes_cents: Math.round(quote.amount_ht),
    total_amount_including_taxes_cents: Math.round(quote.amount_ttc),
    lines: Array.isArray(quote.line_items) ? quote.line_items : [],
  }

  try {
    const res = await fetch(
      `${process.env.TIIME_API_BASE_URL ?? 'https://api.tiime.fr/v1'}/companies/${companyId}/quotes`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      },
    )
    if (!res.ok) {
      return NextResponse.json({ ok: false, message: await res.text() }, { status: 502 })
    }
    const data = (await res.json()) as { id?: string }
    if (!data.id) {
      return NextResponse.json({ ok: false, message: 'Réponse Tiime sans id' }, { status: 502 })
    }
    await supabase
      .from('quotes')
      .update({ tiime_quote_id: data.id, tiime_synced_at: new Date().toISOString() })
      .eq('id', id)
    return NextResponse.json({ ok: true, tiimeQuoteId: data.id })
  } catch (error) {
    return NextResponse.json({ ok: false, message: (error as Error).message }, { status: 502 })
  }
}
