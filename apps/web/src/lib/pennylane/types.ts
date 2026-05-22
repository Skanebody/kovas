/**
 * Types stricts pour l'API Pennylane (https://pennylane.readme.io/reference).
 *
 * NB : nous ne typons que les champs utilisés par KOVAS (sous-ensemble minimal).
 * Les structures Pennylane sont riches — typer seulement ce qu'on consomme évite
 * la dérive lorsque l'API évolue.
 */

// ============================================
// Customer (client Pennylane)
// ============================================

export type PennylaneCustomerSource = 'individual' | 'company'

export interface PennylaneCustomerCreatePayload {
  source_type: PennylaneCustomerSource
  name: string
  first_name?: string | null
  last_name?: string | null
  reg_no?: string | null // SIREN/SIRET
  vat_number?: string | null
  emails?: string[] | null
  phone?: string | null
  address?: string | null
  postal_code?: string | null
  city?: string | null
  country_alpha2?: string | null // ISO 3166-1 alpha-2 (FR, BE, etc.)
}

export interface PennylaneCustomer {
  id: number
  source_id: string
  name: string
  emails: string[] | null
  reg_no: string | null
}

// ============================================
// Invoice (facture client = "customer invoice")
// ============================================

export interface PennylaneInvoiceLineItem {
  label: string
  quantity: number
  unit: string // "piece", "hour", "day", ...
  currency_amount: string // montant unitaire HT en EUR, décimal stringifié
  vat_rate: string // ex. "FR_200" (20%), "FR_100" (10%), "FR_55" (5,5%), "FR_exempt"
}

export interface PennylaneInvoiceCreatePayload {
  customer_id?: number
  external_id?: string // référence KOVAS pour idempotence
  date: string // YYYY-MM-DD (date d'émission)
  deadline?: string // YYYY-MM-DD (échéance)
  draft: boolean // true = brouillon, false = direct finalisé
  currency: 'EUR'
  language?: 'fr_FR' | 'en_GB'
  invoice_lines: PennylaneInvoiceLineItem[]
  special_mention?: string | null
}

export interface PennylaneInvoice {
  id: number
  invoice_number: string | null
  status: string
  draft: boolean
  date: string
  deadline: string | null
  currency_amount: string // TTC
  customer_id: number
  external_id: string | null
  public_url: string | null
}

// ============================================
// Quote (devis)
// ============================================

export interface PennylaneQuoteCreatePayload {
  customer_id: number
  external_id?: string
  date: string
  expiration_date?: string
  currency: 'EUR'
  quote_lines: PennylaneInvoiceLineItem[]
  special_mention?: string | null
}

export interface PennylaneQuote {
  id: number
  quote_number: string | null
  status: string
  date: string
  customer_id: number
  external_id: string | null
}

// ============================================
// Erreurs API
// ============================================

export interface PennylaneApiError {
  message: string
  status: number
  details?: unknown
}

/** Erreur métier remontée par le client KOVAS. */
export class PennylaneError extends Error {
  readonly status: number
  readonly details: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'PennylaneError'
    this.status = status
    this.details = details
  }
}
