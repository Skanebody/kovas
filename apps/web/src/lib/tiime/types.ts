/**
 * Types Tiime — connecteur secondaire (CLAUDE.md §17).
 *
 * Tiime (https://www.tiime.fr) — compta automatique payante. API documentée
 * via bearer token sur https://api.tiime.fr/v1 (à confirmer auprès du support
 * Tiime selon les workspaces actifs).
 */

export interface TiimeCustomer {
  id?: string
  name: string
  email?: string | null
  phone?: string | null
  legal_form?: string | null
  siret?: string | null
  address?: {
    line1?: string | null
    city?: string | null
    zip_code?: string | null
    country_code?: string | null
  }
}

export interface TiimeInvoiceLine {
  description: string
  quantity: number
  /** Prix unitaire HT en centimes (Tiime accepte indifféremment cents ou décimaux selon route) */
  unit_amount_cents: number
  vat_rate: number
}

export interface TiimeInvoice {
  id?: string
  number: string
  customer_id?: string
  customer?: TiimeCustomer
  issue_date: string
  due_date?: string | null
  lines: TiimeInvoiceLine[]
  total_amount_excluding_taxes_cents: number
  total_amount_including_taxes_cents: number
  notes?: string | null
}

export interface TiimeApiCredentials {
  /** Bearer token Tiime */
  accessToken: string
  /** Identifiant du workspace (company_id) Tiime — obligatoire pour la plupart des routes */
  companyId: string
}

export interface TiimeApiResult<T> {
  ok: boolean
  data?: T
  status: number
  message?: string
}
