/**
 * POST /api/invoices/[id]/sync-pennylane
 *
 * Synchronise une facture KOVAS vers Pennylane (PDP DGFiP).
 *
 * Flux :
 *   1. Vérifie connecteur Pennylane actif pour l'organisation
 *   2. Récupère facture + client + (optionnel) snapshot Pennylane existant
 *   3. Si client KOVAS pas encore associé à un Pennylane customer → recherche par SIRET/email
 *      sinon création
 *   4. Crée la facture côté Pennylane (draft=false → finalisation immédiate)
 *   5. Stocke `pennylane_invoice_id` + `pennylane_synced_at` + `pennylane_public_url` côté KOVAS
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import {
  type ClientWithPennylane,
  type KovasInvoiceForPennylane,
  PennylaneError,
  getPennylaneClientForOrg,
  mapClientToPennylaneCustomer,
  mapInvoiceToPennylanePayload,
  normalizeLineItems,
  selectClientForSync,
  selectInvoiceForSync,
  touchConnectorSyncedAt,
  updateClientPennylaneFields,
  updateInvoicePennylaneFields,
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

  // 1. Récupération facture + client
  const { data: invoice, error: invErr } = await selectInvoiceForSync(supabase, id, orgId)
  if (invErr) {
    return NextResponse.json({ error: 'db_error', message: invErr.message }, { status: 500 })
  }
  if (!invoice) {
    return NextResponse.json(
      { error: 'not_found', message: 'Facture introuvable.' },
      { status: 404 },
    )
  }
  if (invoice.pennylane_invoice_id) {
    return NextResponse.json({
      ok: true,
      already_synced: true,
      pennylane_invoice_id: invoice.pennylane_invoice_id,
    })
  }
  if (!invoice.client_id) {
    return NextResponse.json(
      {
        error: 'no_client',
        message: 'Cette facture n’a pas de client associé — impossible de la synchroniser.',
      },
      { status: 422 },
    )
  }

  const { data: client, error: cliErr } = await selectClientForSync(
    supabase,
    invoice.client_id,
    orgId,
  )
  if (cliErr || !client) {
    return NextResponse.json(
      { error: 'client_not_found', message: 'Client KOVAS introuvable.' },
      { status: 404 },
    )
  }

  const lineItems = normalizeLineItems(invoice.line_items)
  if (lineItems.length === 0) {
    return NextResponse.json(
      {
        error: 'empty_lines',
        message: 'La facture n’a aucune ligne valorisée — ajoutez au moins une ligne avant sync.',
      },
      { status: 422 },
    )
  }

  try {
    // 2. Résolution / création du customer Pennylane
    const customerId = await resolvePennylaneCustomer({ pennylane, client })

    // 3. Création facture Pennylane (draft=false → numérotation immédiate)
    const kovasInvoice: KovasInvoiceForPennylane = {
      reference: invoice.reference,
      issued_at: invoice.issued_at,
      due_date: invoice.due_date,
      tva_rate: invoice.tva_rate,
      line_items: lineItems,
    }
    const payload = mapInvoiceToPennylanePayload(kovasInvoice, customerId)
    const created = await pennylane.createInvoice(payload)

    // 4. Persist côté KOVAS
    const now = new Date().toISOString()
    await updateInvoicePennylaneFields(supabase, invoice.id, {
      pennylane_invoice_id: String(created.id),
      pennylane_customer_id: String(customerId),
      pennylane_synced_at: now,
      pennylane_public_url: created.public_url ?? null,
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
      pennylane_invoice_id: created.id,
      pennylane_customer_id: customerId,
      invoice_number: created.invoice_number,
      public_url: created.public_url,
    })
  } catch (err) {
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

  // Cache local
  if (client.pennylane_customer_id) {
    const id = Number(client.pennylane_customer_id)
    if (Number.isFinite(id) && id > 0) return id
  }

  // Recherche par SIRET
  if (client.siret) {
    const existing = await pennylane.findCustomerByRegNo(client.siret)
    if (existing) return existing.id
  }

  // Recherche par email
  if (client.email) {
    const existing = await pennylane.findCustomerByEmail(client.email)
    if (existing) return existing.id
  }

  // Création
  const created = await pennylane.createCustomer(mapClientToPennylaneCustomer(client))
  return created.id
}

function mapStatusToHttp(status: number): number {
  if (status === 401 || status === 403) return 502 // connecteur invalide côté upstream
  if (status === 0 || status >= 500) return 502
  if (status === 422) return 422
  if (status === 429) return 429
  if (status === 504) return 504
  return 502
}
