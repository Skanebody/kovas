/**
 * Types métier centralisés pour le module Factures (P3).
 * Source de vérité : migrations supabase/migrations/20260518000000_init_schema.sql
 * + supabase/migrations/20260527120000_invoices_v1.sql.
 */

export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'partial'
  | 'paid'
  | 'overdue'
  | 'cancelled'

export type PaymentMethod =
  | 'virement'
  | 'sepa'
  | 'card'
  | 'cheque'
  | 'especes'
  | 'prelevement'
  | 'autre'

/** Ligne d'une facture (stockée en JSONB `line_items`). */
export interface InvoiceLineItem {
  /** Code interne (optionnel) — ex: "DPE_VENTE", "AMIANTE_AT" */
  code?: string
  /** Désignation visible client */
  label: string
  /** Quantité (souvent 1 pour une prestation) */
  quantity: number
  /** Prix unitaire HT en euros (float) */
  unit_price_ht: number
  /** Taux TVA en pourcentage (20 = 20 %) */
  tva_rate: number
  /** Optionnel : référence mission liée */
  mission_id?: string | null
}

/** Snapshot client figé au moment de l'émission — rétention 10 ans L123-22. */
export interface InvoiceClientSnapshot {
  display_name: string
  email: string | null
  phone: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  country: string
  siret: string | null
  /** Type au moment de l'émission (particulier/agence/notaire/syndic/...) */
  type: string
}

/** Snapshot émetteur (organization) figé au moment de l'émission. */
export interface InvoiceIssuerSnapshot {
  name: string
  siret: string | null
  vat_number: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  country: string
  iban: string | null
  bic: string | null
  bank_name: string | null
  logo_url: string | null
  brand_color_hex: string | null
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: 'Brouillon',
  issued: 'Émise',
  partial: 'Payée partiellement',
  paid: 'Payée',
  overdue: 'En retard',
  cancelled: 'Annulée',
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  virement: 'Virement bancaire',
  sepa: 'Prélèvement SEPA',
  card: 'Carte bancaire',
  cheque: 'Chèque',
  especes: 'Espèces',
  prelevement: 'Prélèvement',
  autre: 'Autre',
}

/**
 * Calcule les totaux HT / TVA / TTC à partir des line_items.
 * Centimes côté DB (numeric(10,2)) — ici on travaille en euros float
 * et on arrondit à 2 décimales avant insert.
 */
export function computeInvoiceTotals(lineItems: InvoiceLineItem[]): {
  amount_ht: number
  amount_tva: number
  amount_ttc: number
} {
  let ht = 0
  let tva = 0
  for (const item of lineItems) {
    const lineHt = (item.unit_price_ht ?? 0) * (item.quantity ?? 0)
    const lineTva = lineHt * ((item.tva_rate ?? 0) / 100)
    ht += lineHt
    tva += lineTva
  }
  const ttc = ht + tva
  return {
    amount_ht: Math.round(ht * 100) / 100,
    amount_tva: Math.round(tva * 100) / 100,
    amount_ttc: Math.round(ttc * 100) / 100,
  }
}

export function isInvoiceLineItem(value: unknown): value is InvoiceLineItem {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.label === 'string' &&
    typeof v.quantity === 'number' &&
    typeof v.unit_price_ht === 'number' &&
    typeof v.tva_rate === 'number'
  )
}

/**
 * Parse défensif d'une valeur Json (Supabase) en InvoiceLineItem[].
 * Retourne [] si invalide (pas d'erreur lancée — UI affiche état vide).
 */
export function parseLineItems(raw: unknown): InvoiceLineItem[] {
  if (!Array.isArray(raw)) return []
  return raw.filter(isInvoiceLineItem)
}
