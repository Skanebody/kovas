/**
 * Mappers KOVAS → Pennylane.
 *
 * Conventions KOVAS :
 *   - Montants : centimes integer (jamais float)
 *   - TVA : decimal (ex. 20.00 = 20%)
 *   - Dates : ISO 8601 UTC (timestamptz)
 *
 * Conventions Pennylane :
 *   - Montants : decimal stringifié EUR ("123.45")
 *   - TVA : code symbolique ("FR_200" = 20%, "FR_100" = 10%, "FR_55" = 5,5%, "FR_exempt")
 *   - Dates : YYYY-MM-DD (date civile, pas datetime)
 */

import type {
  PennylaneCustomerCreatePayload,
  PennylaneCustomerSource,
  PennylaneInvoiceCreatePayload,
  PennylaneInvoiceLineItem,
  PennylaneQuoteCreatePayload,
} from './types'

// ============================================
// Types d'entrée (sous-ensembles KOVAS strictement nécessaires)
// ============================================

export interface KovasLineItem {
  label: string
  quantity: number
  unit_price_cents: number // HT centimes
  tva_rate?: number | null // ex. 20, 10, 5.5, 0
}

export interface KovasClientForPennylane {
  display_name: string
  type: 'particulier' | 'agence' | 'notaire' | 'syndic' | 'entreprise' | 'collectivite'
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  postal_code?: string | null
  city?: string | null
  country?: string | null
  siret?: string | null
  vat_number?: string | null
}

export interface KovasInvoiceForPennylane {
  reference: string
  issued_at: string | null // ISO datetime
  due_date: string | null // YYYY-MM-DD ou ISO
  tva_rate?: number | null
  line_items: KovasLineItem[]
}

export interface KovasQuoteForPennylane {
  reference: string
  issued_at: string | null
  expires_at: string | null
  tva_rate?: number | null
  line_items: KovasLineItem[]
}

// ============================================
// Conversions élémentaires
// ============================================

/** Centimes → string décimal EUR ("12345" → "123.45"). */
export function centsToDecimalString(cents: number): string {
  if (!Number.isFinite(cents)) return '0.00'
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(Math.round(cents))
  const eur = Math.floor(abs / 100)
  const dec = String(abs % 100).padStart(2, '0')
  return `${sign}${eur}.${dec}`
}

/**
 * KOVAS → code TVA Pennylane.
 * Codes Pennylane (extraits doc) :
 *   FR_200 (20%), FR_100 (10%), FR_55 (5,5%), FR_21 (2,1%), FR_exempt (0% non applicable)
 */
export function tvaRateToPennylaneCode(tvaRate: number | null | undefined): string {
  if (tvaRate === null || tvaRate === undefined || tvaRate === 0) return 'FR_exempt'
  // Normaliser : 20 ou 20.0 → "FR_200"
  const normalized = Number(tvaRate.toFixed(2))
  switch (normalized) {
    case 20:
      return 'FR_200'
    case 10:
      return 'FR_100'
    case 5.5:
      return 'FR_55'
    case 2.1:
      return 'FR_21'
    case 0:
      return 'FR_exempt'
    default:
      // Fallback : multiplier par 10 pour obtenir le code (20% → FR_200, 8.5% → FR_85)
      return `FR_${Math.round(normalized * 10)}`
  }
}

/** ISO datetime → YYYY-MM-DD (date civile UTC). */
export function isoToCivilDate(iso: string | null | undefined): string {
  if (!iso) {
    return new Date().toISOString().slice(0, 10)
  }
  // Si déjà au format YYYY-MM-DD on retourne tel quel
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return new Date().toISOString().slice(0, 10)
  }
  return d.toISOString().slice(0, 10)
}

// ============================================
// Mappers principaux
// ============================================

export function mapClientToPennylaneCustomer(
  client: KovasClientForPennylane,
): PennylaneCustomerCreatePayload {
  const isCompany = client.type !== 'particulier'
  const sourceType: PennylaneCustomerSource = isCompany ? 'company' : 'individual'

  const name = isCompany ? client.company_name?.trim() || client.display_name : client.display_name

  return {
    source_type: sourceType,
    name,
    first_name: isCompany ? null : (client.first_name ?? null),
    last_name: isCompany ? null : (client.last_name ?? null),
    reg_no: client.siret ?? null,
    vat_number: client.vat_number ?? null,
    emails: client.email ? [client.email] : null,
    phone: client.phone ?? null,
    address: client.address ?? null,
    postal_code: client.postal_code ?? null,
    city: client.city ?? null,
    country_alpha2: (client.country ?? 'FR').toUpperCase().slice(0, 2),
  }
}

function mapLineItem(
  item: KovasLineItem,
  defaultTvaRate: number | null | undefined,
): PennylaneInvoiceLineItem {
  const tvaRate = item.tva_rate ?? defaultTvaRate ?? 20
  return {
    label: item.label,
    quantity: item.quantity > 0 ? item.quantity : 1,
    unit: 'piece',
    currency_amount: centsToDecimalString(item.unit_price_cents),
    vat_rate: tvaRateToPennylaneCode(tvaRate),
  }
}

export function mapInvoiceToPennylanePayload(
  invoice: KovasInvoiceForPennylane,
  customerId: number,
): PennylaneInvoiceCreatePayload {
  return {
    customer_id: customerId,
    external_id: invoice.reference,
    date: isoToCivilDate(invoice.issued_at),
    deadline: invoice.due_date ? isoToCivilDate(invoice.due_date) : undefined,
    draft: false, // émission directe : Pennylane finalise et numérote
    currency: 'EUR',
    language: 'fr_FR',
    invoice_lines: invoice.line_items.map((l) => mapLineItem(l, invoice.tva_rate)),
    special_mention: `Référence interne KOVAS : ${invoice.reference}`,
  }
}

export function mapQuoteToPennylanePayload(
  quote: KovasQuoteForPennylane,
  customerId: number,
): PennylaneQuoteCreatePayload {
  return {
    customer_id: customerId,
    external_id: quote.reference,
    date: isoToCivilDate(quote.issued_at),
    expiration_date: quote.expires_at ? isoToCivilDate(quote.expires_at) : undefined,
    currency: 'EUR',
    quote_lines: quote.line_items.map((l) => mapLineItem(l, quote.tva_rate)),
    special_mention: `Référence interne KOVAS : ${quote.reference}`,
  }
}

/**
 * Normalise un `line_items` JSON brut DB en `KovasLineItem[]` typé.
 * Tolérant aux variations de schéma legacy.
 */
export function normalizeLineItems(raw: unknown): KovasLineItem[] {
  if (!Array.isArray(raw)) return []
  const out: KovasLineItem[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const e = entry as Record<string, unknown>
    const label =
      typeof e.label === 'string'
        ? e.label
        : typeof e.description === 'string'
          ? e.description
          : null
    const quantity = typeof e.quantity === 'number' ? e.quantity : 1
    const unitPriceCents =
      typeof e.unit_price_cents === 'number'
        ? e.unit_price_cents
        : typeof e.price_cents === 'number'
          ? e.price_cents
          : null
    if (!label || unitPriceCents === null) continue
    const tvaRate =
      typeof e.tva_rate === 'number'
        ? e.tva_rate
        : typeof e.vat_rate === 'number'
          ? e.vat_rate
          : null
    out.push({
      label,
      quantity,
      unit_price_cents: unitPriceCents,
      tva_rate: tvaRate,
    })
  }
  return out
}
