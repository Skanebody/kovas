/**
 * Mappers KOVAS ↔ Indy.
 *
 * KOVAS stocke les montants en centimes (entier). Indy attend des décimaux en
 * euros — on convertit ici, en arrondissant à 2 décimales.
 */

import type { IndyCustomer, IndyInvoice, IndyInvoiceLine } from './types'

interface KovasClientLike {
  display_name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  country: string | null
  siret: string | null
}

interface KovasInvoiceLineItem {
  description: string
  quantity: number
  /** Prix unitaire HT en centimes */
  unit_price_cents: number
  /** Taux TVA en pourcentage (20, 10, 5.5, 0) */
  vat_rate?: number
}

interface KovasInvoiceLike {
  reference: string
  amount_ht: number // centimes
  amount_ttc: number // centimes
  tva_rate: number | null // pourcent
  line_items: KovasInvoiceLineItem[] | unknown
  issued_at: string | null
  due_date: string | null
  notes?: string | null
}

function centsToEur(cents: number): number {
  return Math.round(cents) / 100
}

export function clientToIndyCustomer(client: KovasClientLike): IndyCustomer {
  return {
    name: client.display_name,
    email: client.email,
    phone: client.phone,
    siret: client.siret,
    address: {
      street: client.address,
      city: client.city,
      postal_code: client.postal_code,
      country: client.country ?? 'FR',
    },
  }
}

function parseLineItems(raw: unknown): KovasInvoiceLineItem[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((it): it is KovasInvoiceLineItem => {
    if (typeof it !== 'object' || it === null) return false
    const obj = it as Record<string, unknown>
    return (
      typeof obj.description === 'string' &&
      typeof obj.quantity === 'number' &&
      typeof obj.unit_price_cents === 'number'
    )
  })
}

export function invoiceToIndyInvoice(invoice: KovasInvoiceLike, customerId?: string): IndyInvoice {
  const items = parseLineItems(invoice.line_items)
  const defaultVat = invoice.tva_rate ?? 20
  const lines: IndyInvoiceLine[] = items.map((it) => ({
    description: it.description,
    quantity: it.quantity,
    unit_price_eur: centsToEur(it.unit_price_cents),
    vat_rate: it.vat_rate ?? defaultVat,
  }))

  return {
    reference: invoice.reference,
    customer_id: customerId,
    issued_at: invoice.issued_at ?? new Date().toISOString(),
    due_date: invoice.due_date,
    lines,
    total_ht_eur: centsToEur(invoice.amount_ht),
    total_ttc_eur: centsToEur(invoice.amount_ttc),
    notes: invoice.notes ?? null,
  }
}
