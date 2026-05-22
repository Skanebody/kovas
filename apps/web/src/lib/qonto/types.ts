/**
 * Types TypeScript stricts pour l'API Qonto (PDP DGFiP).
 *
 * Doc officielle : https://api-doc.qonto.com/
 * Base URL : https://thirdparty.qonto.com/v2
 *
 * Tous les montants Qonto sont en euros (string décimaux) — KOVAS stocke
 * en centimes integer ; conversion via apps/web/src/lib/qonto/mapper.ts.
 */

// ============================================
// Auth & client config
// ============================================

export interface QontoCredentials {
  /** Identifiant API Qonto (format `prefix_xxxxxx`) */
  login: string
  /** Clé secrète Qonto */
  secretKey: string
  /** Slug organisation Qonto (optionnel — auto-résolu via /organizations) */
  organizationSlug?: string
}

export interface QontoClientOptions extends QontoCredentials {
  /** Override base URL (tests / sandbox). Défaut : prod thirdparty. */
  baseUrl?: string
  /** Timeout requête HTTP en ms. Défaut : 15 000. */
  timeoutMs?: number
  /** Max tentatives sur 5xx / timeout. Défaut : 3. */
  maxRetries?: number
}

// ============================================
// Clients (customers Qonto)
// ============================================

export type QontoClientType = 'company' | 'individual' | 'freelancer'

export interface QontoClientPayload {
  type: QontoClientType
  /** Pour `company` / `freelancer` */
  name?: string
  /** Pour `individual` */
  first_name?: string
  last_name?: string
  email?: string
  vat_number?: string
  tax_identification_number?: string
  currency?: string
  locale?: 'FR' | 'EN' | 'DE' | 'ES' | 'IT'
  billing_address?: QontoAddress
  delivery_address?: QontoAddress
}

export interface QontoAddress {
  street_address: string
  city: string
  zip_code: string
  country_code: string // ISO 3166-1 alpha-2 (FR, BE, …)
  province_code?: string
}

export interface QontoClientResponse {
  id: string
  type: QontoClientType
  name?: string
  first_name?: string
  last_name?: string
  email?: string
  vat_number?: string
  tax_identification_number?: string
  currency: string
  locale: string
  billing_address?: QontoAddress
  delivery_address?: QontoAddress
  created_at: string
}

// ============================================
// Factures clients
// ============================================

export type QontoVatRate =
  | 'exempt'
  | 'reverse_charge'
  | 'not_applicable'
  | '0'
  | '2.1'
  | '5.5'
  | '8.5'
  | '10'
  | '13'
  | '20'

export interface QontoInvoiceItem {
  title: string
  description?: string
  quantity: string
  unit_price: {
    value: string // décimal en string : "150.00"
    currency: string // ISO 4217 : "EUR"
  }
  vat_rate: QontoVatRate
  discount?: {
    type: 'percentage' | 'absolute'
    value: string
  }
  unit?: string
}

export interface QontoInvoicePayload {
  client_id: string
  issue_date: string // YYYY-MM-DD
  due_date: string // YYYY-MM-DD
  performance_date?: string
  status?: 'draft' | 'unpaid'
  number?: string
  purchase_order?: string
  terms_and_conditions?: string
  header?: string
  footer?: string
  currency?: string // EUR par défaut
  items: QontoInvoiceItem[]
  payment_methods?: {
    iban?: string
    beneficiary_name?: string
  }
  report_einvoicing_to_government?: boolean // PDP DGFiP — true pour transmission officielle
}

export interface QontoInvoiceResponse {
  id: string
  number: string
  status: string
  client: QontoClientResponse
  organization: { id: string; legal_name: string; slug: string }
  issue_date: string
  due_date: string
  total_amount: { value: string; currency: string }
  total_amount_cents: number
  invoice_url?: string
  einvoicing_status?: string
  created_at: string
}

// ============================================
// Organisation
// ============================================

export interface QontoOrganizationResponse {
  organization: {
    id: string
    slug: string
    legal_name: string
    legal_country: string
    legal_registration_number?: string
    vat_number?: string
    bank_accounts: Array<{
      slug: string
      iban: string
      bic: string
      currency: string
      balance_cents: number
      authorized_balance_cents: number
      status: string
    }>
  }
}

// ============================================
// Erreurs structurées
// ============================================

export class QontoApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message)
    this.name = 'QontoApiError'
  }
}

export interface QontoErrorResponse {
  errors?: Array<{ code?: string; detail?: string; source?: { pointer?: string } }>
  error?: string
  message?: string
}

// ============================================
// Mapping KOVAS — entrées du mapper
// ============================================

export interface KovasInvoiceForMapping {
  id: string
  reference: string
  issued_at: string | null
  due_date: string | null
  amount_ht: number | string
  amount_tva: number | string
  amount_ttc: number | string
  tva_rate: number | string | null
  line_items: KovasInvoiceLineItem[]
  client_snapshot?: Record<string, unknown> | null
  qonto_customer_id?: string | null
}

export interface KovasInvoiceLineItem {
  label: string
  description?: string
  quantity: number
  unit_price_cents: number
  vat_rate?: number // 0.20 → 20%
}

export interface KovasClientForMapping {
  id: string
  type: 'particulier' | 'professionnel' | string
  display_name: string
  first_name?: string | null
  last_name?: string | null
  company_name?: string | null
  email?: string | null
  address?: string | null
  city?: string | null
  postal_code?: string | null
  country?: string | null
  siret?: string | null
}
