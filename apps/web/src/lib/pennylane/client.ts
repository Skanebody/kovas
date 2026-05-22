/**
 * Client HTTP Pennylane (https://pennylane.readme.io/reference).
 *
 * Auth : Bearer token (Pennylane Pro ~22€/mo → Paramètres → API → "Générer un token").
 * Base URL : https://app.pennylane.com/api/external/v1
 *
 * Particularités :
 *   - Toutes les routes sont JSON
 *   - Codes 401/403 = token invalide ; 422 = payload rejeté ; 429 = rate limit
 *   - Idempotence : on utilise `external_id` (référence interne KOVAS) pour éviter les doublons
 */

import {
  type PennylaneCustomer,
  type PennylaneCustomerCreatePayload,
  PennylaneError,
  type PennylaneInvoice,
  type PennylaneInvoiceCreatePayload,
  type PennylaneQuote,
  type PennylaneQuoteCreatePayload,
} from './types'

const DEFAULT_BASE_URL = 'https://app.pennylane.com/api/external/v1'

interface ClientOptions {
  apiToken: string
  baseUrl?: string
  /** Timeout par requête en ms (défaut 15s) */
  timeoutMs?: number
}

interface ListCustomersFilters {
  reg_no?: string
  email?: string
  per_page?: number
  page?: number
}

interface ListCustomersResponse {
  customers: PennylaneCustomer[]
  total_pages?: number
  current_page?: number
}

export class PennylaneClient {
  private readonly apiToken: string
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(opts: ClientOptions) {
    if (!opts.apiToken) {
      throw new PennylaneError('API token manquant', 400)
    }
    this.apiToken = opts.apiToken
    this.baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL
    this.timeoutMs = opts.timeoutMs ?? 15_000
  }

  // ============================================
  // Test connexion (ping)
  // ============================================

  /**
   * Vérifie la validité du token en interrogeant /customers?per_page=1.
   * Retourne true si l'API répond 2xx, sinon lance PennylaneError.
   */
  async ping(): Promise<boolean> {
    await this.request<unknown>('GET', '/customers?per_page=1')
    return true
  }

  // ============================================
  // Customers
  // ============================================

  async listCustomers(filters: ListCustomersFilters = {}): Promise<ListCustomersResponse> {
    const params = new URLSearchParams()
    if (filters.reg_no) params.set('filter[reg_no]', filters.reg_no)
    if (filters.email) params.set('filter[email]', filters.email)
    params.set('per_page', String(filters.per_page ?? 25))
    if (filters.page) params.set('page', String(filters.page))
    return this.request<ListCustomersResponse>('GET', `/customers?${params.toString()}`)
  }

  async findCustomerByRegNo(regNo: string): Promise<PennylaneCustomer | null> {
    const res = await this.listCustomers({ reg_no: regNo, per_page: 1 })
    return res.customers[0] ?? null
  }

  async findCustomerByEmail(email: string): Promise<PennylaneCustomer | null> {
    const res = await this.listCustomers({ email, per_page: 1 })
    return res.customers[0] ?? null
  }

  async createCustomer(payload: PennylaneCustomerCreatePayload): Promise<PennylaneCustomer> {
    const res = await this.request<{ customer: PennylaneCustomer }>('POST', '/customers', {
      customer: payload,
    })
    return res.customer
  }

  // ============================================
  // Invoices (customer_invoices)
  // ============================================

  /**
   * Crée une facture. Si `draft: false`, Pennylane la finalise immédiatement
   * (numérotation officielle attribuée). Sinon elle reste en brouillon.
   */
  async createInvoice(payload: PennylaneInvoiceCreatePayload): Promise<PennylaneInvoice> {
    const res = await this.request<{ invoice: PennylaneInvoice }>('POST', '/customer_invoices', {
      invoice: payload,
    })
    return res.invoice
  }

  /**
   * Finalise une facture brouillon (attribution du numéro officiel + verrouillage).
   * À appeler seulement si la facture a été créée en `draft: true`.
   */
  async finalizeInvoice(invoiceId: number): Promise<PennylaneInvoice> {
    const res = await this.request<{ invoice: PennylaneInvoice }>(
      'POST',
      `/customer_invoices/${invoiceId}/finalize`,
    )
    return res.invoice
  }

  // ============================================
  // Quotes (estimates)
  // ============================================

  /**
   * Crée un devis Pennylane. À noter : tous les abonnements Pennylane ne supportent
   * pas l'endpoint quotes — si réponse 404/405, on dégrade côté KOVAS (devis non syncé).
   */
  async createQuote(payload: PennylaneQuoteCreatePayload): Promise<PennylaneQuote> {
    const res = await this.request<{ estimate: PennylaneQuote }>('POST', '/estimates', {
      estimate: payload,
    })
    return res.estimate
  }

  // ============================================
  // Helpers internes
  // ============================================

  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs)

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        cache: 'no-store',
      })

      const text = await response.text()
      const parsed: unknown = text ? safeParseJson(text) : null

      if (!response.ok) {
        const message =
          extractErrorMessage(parsed) ?? `HTTP ${response.status} ${response.statusText}`
        throw new PennylaneError(message, response.status, parsed)
      }

      return (parsed ?? {}) as T
    } catch (err) {
      if (err instanceof PennylaneError) throw err
      if (err instanceof Error && err.name === 'AbortError') {
        throw new PennylaneError('Timeout Pennylane', 504)
      }
      throw new PennylaneError(err instanceof Error ? err.message : 'Erreur réseau Pennylane', 0)
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { raw: text }
  }
}

function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>
  if (typeof obj.message === 'string') return obj.message
  if (typeof obj.error === 'string') return obj.error
  if (Array.isArray(obj.errors) && obj.errors.length > 0) {
    const first = obj.errors[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object' && 'message' in (first as Record<string, unknown>)) {
      const m = (first as Record<string, unknown>).message
      if (typeof m === 'string') return m
    }
  }
  return null
}
