/**
 * Mappers KOVAS ↔ Qonto.
 *
 * Conversions clés :
 *   - centimes integer (KOVAS) ↔ euros décimaux string (Qonto)
 *   - TVA float 0.20 (interne) ↔ string "20" (Qonto enum)
 *   - dates ISO → YYYY-MM-DD
 *   - type client KOVAS ('particulier'|'professionnel') → Qonto ('individual'|'company')
 */

import type {
  KovasClientForMapping,
  KovasInvoiceForMapping,
  KovasInvoiceLineItem,
  QontoClientPayload,
  QontoInvoiceItem,
  QontoInvoicePayload,
  QontoVatRate,
} from './types'

// ============================================
// Centimes ↔ euros décimal string (2 décimales)
// ============================================

export function centsToEurString(cents: number): string {
  if (!Number.isFinite(cents)) throw new Error('[mapper] cents non fini.')
  // Évite les artefacts flottants : on travaille en integer puis on insère le séparateur.
  const rounded = Math.round(cents)
  const sign = rounded < 0 ? '-' : ''
  const abs = Math.abs(rounded).toString().padStart(3, '0')
  const intPart = abs.slice(0, -2)
  const decPart = abs.slice(-2)
  return `${sign}${intPart}.${decPart}`
}

export function eurStringToCents(value: string): number {
  const cleaned = value.replace(',', '.').trim()
  const num = Number.parseFloat(cleaned)
  if (!Number.isFinite(num)) throw new Error(`[mapper] euros invalide: "${value}"`)
  return Math.round(num * 100)
}

/** Convertit une valeur stockée en `numeric` Postgres (string ou number) en centimes. */
function numericToCents(val: number | string): number {
  if (typeof val === 'number') return Math.round(val * 100)
  return eurStringToCents(val)
}

// ============================================
// TVA : float 0.20 → enum string Qonto "20"
// ============================================

const QONTO_VAT_VALUES: ReadonlySet<string> = new Set([
  '0',
  '2.1',
  '5.5',
  '8.5',
  '10',
  '13',
  '20',
])

export function tvaRateToQonto(rate: number | string | null | undefined): QontoVatRate {
  if (rate === null || rate === undefined) return '20'
  const num = typeof rate === 'number' ? rate : Number.parseFloat(rate.replace(',', '.'))
  if (!Number.isFinite(num) || num <= 0) return '0'

  // KOVAS stocke parfois "20.00" (numeric Postgres), parfois 0.20 (float lib).
  // Si <= 1 on assume ratio, sinon on assume pourcentage.
  const pct = num <= 1 ? num * 100 : num
  const asString = pct.toFixed(2).replace(/\.?0+$/, '') // "20.00" → "20", "5.50" → "5.5"

  if (QONTO_VAT_VALUES.has(asString)) return asString as QontoVatRate
  // Fallback : approximation par valeur la plus proche
  const candidates = [0, 2.1, 5.5, 8.5, 10, 13, 20]
  let closest = 20
  let diff = Infinity
  for (const c of candidates) {
    const d = Math.abs(c - pct)
    if (d < diff) {
      diff = d
      closest = c
    }
  }
  const out = closest.toString().replace(/\.0$/, '')
  return out as QontoVatRate
}

// ============================================
// Dates
// ============================================

/** Renvoie YYYY-MM-DD à partir d'une date ISO ou null (fallback : aujourd'hui). */
export function toIsoDate(value: string | Date | null | undefined, fallback?: Date): string {
  const src = value ? new Date(value) : (fallback ?? new Date())
  if (!Number.isFinite(src.getTime())) throw new Error(`[mapper] date invalide: ${String(value)}`)
  const y = src.getUTCFullYear()
  const m = String(src.getUTCMonth() + 1).padStart(2, '0')
  const d = String(src.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Ajoute N jours à une ISO date et renvoie YYYY-MM-DD. */
export function addDaysIso(value: string | Date | null | undefined, days: number): string {
  const base = value ? new Date(value) : new Date()
  base.setUTCDate(base.getUTCDate() + days)
  return toIsoDate(base)
}

// ============================================
// Mapping client KOVAS → Qonto
// ============================================

export function mapKovasClientToQonto(client: KovasClientForMapping): QontoClientPayload {
  const isCompany = client.type === 'professionnel' || Boolean(client.company_name)
  const payload: QontoClientPayload = {
    type: isCompany ? 'company' : 'individual',
    email: client.email ?? undefined,
    currency: 'EUR',
    locale: 'FR',
  }

  if (isCompany) {
    payload.name = client.company_name ?? client.display_name
    if (client.siret) payload.tax_identification_number = client.siret
  } else {
    // KOVAS expose souvent uniquement display_name pour particuliers.
    // On essaie de splitter, sinon on met tout dans first_name.
    if (client.first_name || client.last_name) {
      payload.first_name = client.first_name ?? ''
      payload.last_name = client.last_name ?? client.display_name
    } else {
      const parts = client.display_name.trim().split(/\s+/)
      if (parts.length >= 2) {
        payload.first_name = parts[0]
        payload.last_name = parts.slice(1).join(' ')
      } else {
        payload.first_name = client.display_name
        payload.last_name = client.display_name
      }
    }
  }

  if (client.address && client.city && client.postal_code) {
    payload.billing_address = {
      street_address: client.address,
      city: client.city,
      zip_code: client.postal_code,
      country_code: (client.country ?? 'FR').toUpperCase().slice(0, 2),
    }
  }

  return payload
}

// ============================================
// Mapping facture KOVAS → Qonto
// ============================================

interface MapInvoiceOptions {
  /** ID client Qonto (déjà créé ou résolu en amont). Obligatoire. */
  qontoClientId: string
  /** Active la transmission e-invoicing officielle DGFiP (Phase 2 KOVAS). */
  reportToGovernment?: boolean
  /** Footer libre (mentions légales, BIC/IBAN…). */
  footer?: string
}

export function mapKovasInvoiceToQonto(
  invoice: KovasInvoiceForMapping,
  opts: MapInvoiceOptions,
): QontoInvoicePayload {
  if (!opts.qontoClientId) {
    throw new Error('[mapper] qontoClientId requis pour mapper une facture KOVAS → Qonto.')
  }

  const issueDate = toIsoDate(invoice.issued_at, new Date())
  const dueDate = invoice.due_date
    ? toIsoDate(invoice.due_date)
    : addDaysIso(issueDate, 30) // défaut 30j Code Commerce

  const vatRate = tvaRateToQonto(invoice.tva_rate)

  const items: QontoInvoiceItem[] = (invoice.line_items ?? []).map((li) =>
    mapLineItem(li, vatRate),
  )

  // Fallback : si aucune ligne, créer une ligne unique depuis amount_ht
  if (items.length === 0) {
    const totalHtCents = numericToCents(invoice.amount_ht)
    items.push({
      title: `Prestation ${invoice.reference}`,
      quantity: '1',
      unit_price: { value: centsToEurString(totalHtCents), currency: 'EUR' },
      vat_rate: vatRate,
    })
  }

  const payload: QontoInvoicePayload = {
    client_id: opts.qontoClientId,
    issue_date: issueDate,
    due_date: dueDate,
    number: invoice.reference,
    status: 'unpaid', // KOVAS sync uniquement les factures émises
    currency: 'EUR',
    items,
    report_einvoicing_to_government: opts.reportToGovernment ?? false,
  }

  if (opts.footer) payload.footer = opts.footer

  return payload
}

function mapLineItem(li: KovasInvoiceLineItem, fallbackVat: QontoVatRate): QontoInvoiceItem {
  return {
    title: li.label,
    description: li.description,
    quantity: Number.isFinite(li.quantity) ? li.quantity.toString() : '1',
    unit_price: {
      value: centsToEurString(li.unit_price_cents),
      currency: 'EUR',
    },
    vat_rate: li.vat_rate !== undefined ? tvaRateToQonto(li.vat_rate) : fallbackVat,
  }
}
