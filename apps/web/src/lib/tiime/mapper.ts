/**
 * Mappers KOVAS ↔ Tiime.
 */

import type { TiimeCustomer, TiimeInvoice, TiimeInvoiceLine } from './types'

interface KovasClientLike {
  display_name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  country: string | null
  siret: string | null
  type?: string | null
}

interface KovasInvoiceLineItem {
  description: string
  quantity: number
  unit_price_cents: number
  vat_rate?: number
}

interface KovasInvoiceLike {
  reference: string
  amount_ht: number
  amount_ttc: number
  tva_rate: number | null
  line_items: unknown
  issued_at: string | null
  due_date: string | null
  notes?: string | null
}

export function clientToTiimeCustomer(client: KovasClientLike): TiimeCustomer {
  return {
    name: client.display_name,
    email: client.email,
    phone: client.phone,
    legal_form: client.type ?? null,
    siret: client.siret,
    address: {
      line1: client.address,
      city: client.city,
      zip_code: client.postal_code,
      country_code: client.country ?? 'FR',
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

export function invoiceToTiimeInvoice(
  invoice: KovasInvoiceLike,
  customerId?: string,
): TiimeInvoice {
  const items = parseLineItems(invoice.line_items)
  const defaultVat = invoice.tva_rate ?? 20
  const lines: TiimeInvoiceLine[] = items.map((it) => ({
    description: it.description,
    quantity: it.quantity,
    unit_amount_cents: Math.round(it.unit_price_cents),
    vat_rate: it.vat_rate ?? defaultVat,
  }))

  return {
    number: invoice.reference,
    customer_id: customerId,
    issue_date: invoice.issued_at ?? new Date().toISOString(),
    due_date: invoice.due_date,
    lines,
    total_amount_excluding_taxes_cents: Math.round(invoice.amount_ht),
    total_amount_including_taxes_cents: Math.round(invoice.amount_ttc),
    notes: invoice.notes ?? null,
  }
}
