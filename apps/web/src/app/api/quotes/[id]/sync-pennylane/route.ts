/**
 * POST /api/quotes/[id]/sync-pennylane
 *
 * Synchronise un devis KOVAS vers Pennylane (estimate).
 * Si l'endpoint `/estimates` n'est pas activé sur l'abonnement Pennylane,
 * l'erreur 404/405 est remontée proprement (statut 501 côté KOVAS).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import {
  type ClientWithPennylane,
  type KovasQuoteForPennylane,
  PennylaneError,
  getPennylaneClientForOrg,
  mapClientToPennylaneCustomer,
  mapQuoteToPennylanePayload,
  normalizeLineItems,
  selectClientForSync,
  selectQuoteForSync,
  touchConnectorSyncedAt,
  updateClientPennylaneFields,
  updateQuotePennylaneFields,
} from '@/lib/pennylane'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, orgId } = await getCurrentUser()

  const pennylane = await getPennylaneClientForOrg(supabase, orgId)
  if (!pennylane) {
    return NextResponse.json(
      {
        error: 'connector_inactive',
        message:
          'Aucun connecteur Pennylane actif. Configurez le token dans Compte → Intégrations → Pennylane.',
      },
      { status: 412 },
    )
  }

  const { data: quote, error: qErr } = await selectQuoteForSync(supabase, id, orgId)
  if (qErr) {
    return NextResponse.json({ error: 'db_error', message: qErr.message }, { status: 500 })
  }
  if (!quote) {
    return NextResponse.json({ error: 'not_found', message: 'Devis introuvable.' }, { status: 404 })
  }
  if (quote.pennylane_quote_id) {
    return NextResponse.json({
      ok: true,
      already_synced: true,
      pennylane_quote_id: quote.pennylane_quote_id,
    })
  }
  if (!quote.client_id) {
    return NextResponse.json(
      { error: 'no_client', message: 'Ce devis n’a pas de client associé.' },
      { status: 422 },
    )
  }

  const { data: client, error: cliErr } = await selectClientForSync(
    supabase,
    quote.client_id,
    orgId,
  )
  if (cliErr || !client) {
    return NextResponse.json(
      { error: 'client_not_found', message: 'Client KOVAS introuvable.' },
      { status: 404 },
    )
  }

  const lineItems = normalizeLineItems(quote.line_items)
  if (lineItems.length === 0) {
    return NextResponse.json(
      { error: 'empty_lines', message: 'Le devis n’a aucune ligne valorisée.' },
      { status: 422 },
    )
  }

  try {
    const customerId = await resolvePennylaneCustomer({ pennylane, client })

    const kovasQuote: KovasQuoteForPennylane = {
      reference: quote.reference,
      issued_at: quote.issued_at,
      expires_at: quote.expires_at,
      tva_rate: quote.tva_rate,
      line_items: lineItems,
    }
    const payload = mapQuoteToPennylanePayload(kovasQuote, customerId)
    const created = await pennylane.createQuote(payload)

    const now = new Date().toISOString()
    await updateQuotePennylaneFields(supabase, quote.id, {
      pennylane_quote_id: String(created.id),
      pennylane_customer_id: String(customerId),
      pennylane_synced_at: now,
    })

    if (!client.pennylane_customer_id) {
      await updateClientPennylaneFields(supabase, client.id, {
        pennylane_customer_id: String(customerId),
        pennylane_synced_at: now,
      })
    }

    await touchConnectorSyncedAt(supabase, orgId, 'pennylane', now)

    return NextResponse.json({
      ok: true,
      pennylane_quote_id: created.id,
      pennylane_customer_id: customerId,
      quote_number: created.quote_number,
    })
  } catch (err) {
    if (err instanceof PennylaneError && (err.status === 404 || err.status === 405)) {
      return NextResponse.json(
        {
          error: 'quotes_not_supported',
          message:
            'Votre abonnement Pennylane ne supporte pas la sync des devis. La facture finale pourra être synchronisée normalement.',
        },
        { status: 501 },
      )
    }
    const message = err instanceof PennylaneError ? err.message : 'Erreur inconnue'
    const status = err instanceof PennylaneError ? mapStatusToHttp(err.status) : 500
    return NextResponse.json({ error: 'pennylane_error', message }, { status })
  }
}

async function resolvePennylaneCustomer(args: {
  pennylane: NonNullable<Awaited<ReturnType<typeof getPennylaneClientForOrg>>>
  client: ClientWithPennylane
}): Promise<number> {
  const { pennylane, client } = args
  if (client.pennylane_customer_id) {
    const id = Number(client.pennylane_customer_id)
    if (Number.isFinite(id) && id > 0) return id
  }
  if (client.siret) {
    const existing = await pennylane.findCustomerByRegNo(client.siret)
    if (existing) return existing.id
  }
  if (client.email) {
    const existing = await pennylane.findCustomerByEmail(client.email)
    if (existing) return existing.id
  }
  const created = await pennylane.createCustomer(mapClientToPennylaneCustomer(client))
  return created.id
}

function mapStatusToHttp(status: number): number {
  if (status === 401 || status === 403) return 502
  if (status === 0 || status >= 500) return 502
  if (status === 422) return 422
  if (status === 429) return 429
  if (status === 504) return 504
  return 502
}
