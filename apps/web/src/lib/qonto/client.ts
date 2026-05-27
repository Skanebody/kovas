/**
 * Client HTTP minimaliste pour l'API Qonto v2.
 *
 * Auth : header `Authorization: <login>:<secret_key>` (format propre Qonto, pas Bearer).
 *
 * Comportement :
 *   - 2xx : parse JSON et retourne le payload typé
 *   - 4xx : throw QontoApiError immédiatement (erreur client → pas de retry)
 *   - 5xx ou network timeout : retry avec backoff exponentiel (200ms, 600ms, 1.8s)
 *
 * Multi-tenant : 1 instance par organisation, instanciée à la demande
 * (token déchiffré depuis `accounting_connectors`).
 */

import {
  QontoApiError,
  type QontoClientOptions,
  type QontoClientPayload,
  type QontoClientResponse,
  type QontoErrorResponse,
  type QontoInvoicePayload,
  type QontoInvoiceResponse,
  type QontoOrganizationResponse,
} from './types'

const DEFAULT_BASE_URL = 'https://thirdparty.qonto.com/v2'
const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_MAX_RETRIES = 3

interface RawResponse {
  status: number
  body: unknown
}

export class QontoClient {
  private readonly baseUrl: string
  private readonly authHeader: string
  private readonly timeoutMs: number
  private readonly maxRetries: number
  private readonly organizationSlug?: string

  constructor(opts: QontoClientOptions) {
    if (!opts.login || !opts.secretKey) {
      throw new Error('[QontoClient] login et secretKey sont requis.')
    }
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
    this.authHeader = `${opts.login}:${opts.secretKey}`
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.maxRetries = Math.max(1, opts.maxRetries ?? DEFAULT_MAX_RETRIES)
    this.organizationSlug = opts.organizationSlug
  }

  // ============================================
  // Endpoints publics
  // ============================================

  async getOrganization(): Promise<QontoOrganizationResponse> {
    const slug = this.organizationSlug
    const path = slug ? `/organizations/${encodeURIComponent(slug)}` : '/organization'
    const { body } = await this.request('GET', path)
    return body as QontoOrganizationResponse
  }

  async createClient(payload: QontoClientPayload): Promise<QontoClientResponse> {
    const { body } = await this.request('POST', '/clients', { client: payload })
    const wrapped = body as { client?: QontoClientResponse }
    if (!wrapped?.client?.id) {
      throw new QontoApiError(500, 'invalid_response', 'Réponse Qonto sans `client.id`.', body)
    }
    return wrapped.client
  }

  async listClients(params?: { email?: string; name?: string }): Promise<QontoClientResponse[]> {
    const qs = new URLSearchParams()
    if (params?.email) qs.set('filter[email]', params.email)
    if (params?.name) qs.set('filter[name]', params.name)
    const path = qs.size > 0 ? `/clients?${qs.toString()}` : '/clients'
    const { body } = await this.request('GET', path)
    const wrapped = body as { clients?: QontoClientResponse[] }
    return wrapped?.clients ?? []
  }

  async createInvoice(payload: QontoInvoicePayload): Promise<QontoInvoiceResponse> {
    const { body } = await this.request('POST', '/client_invoices', { client_invoice: payload })
    const wrapped = body as { client_invoice?: QontoInvoiceResponse }
    if (!wrapped?.client_invoice?.id) {
      throw new QontoApiError(
        500,
        'invalid_response',
        'Réponse Qonto sans `client_invoice.id`.',
        body,
      )
    }
    return wrapped.client_invoice
  }

  /** Test rapide de connexion (lit l'org — endpoint cheap). */
  async testConnection(): Promise<{ ok: true; legalName: string; slug: string }> {
    const res = await this.getOrganization()
    return {
      ok: true,
      legalName: res.organization.legal_name,
      slug: res.organization.slug,
    }
  }

  // ============================================
  // Implémentation interne
  // ============================================

  private async request(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    jsonBody?: unknown,
  ): Promise<RawResponse> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
    let lastError: unknown = null

    for (let attempt = 1; attempt <= this.maxRetries; attempt += 1) {
      try {
        const res = await this.fetchOnce(method, url, jsonBody)

        // 4xx : pas de retry, throw immédiatement
        if (res.status >= 400 && res.status < 500) {
          throw this.toApiError(res.status, res.body)
        }

        // 5xx : retry avec backoff
        if (res.status >= 500) {
          lastError = this.toApiError(res.status, res.body)
          if (attempt < this.maxRetries) {
            await sleep(backoffMs(attempt))
            continue
          }
          throw lastError
        }

        return res
      } catch (err) {
        // QontoApiError 4xx : bubble up direct
        if (err instanceof QontoApiError && err.statusCode >= 400 && err.statusCode < 500) {
          throw err
        }
        lastError = err
        if (attempt < this.maxRetries) {
          await sleep(backoffMs(attempt))
          continue
        }
      }
    }

    if (lastError instanceof Error) throw lastError
    throw new QontoApiError(0, 'unknown', 'Échec après retries Qonto.', lastError)
  }

  private async fetchOnce(method: string, url: string, jsonBody?: unknown): Promise<RawResponse> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs)

    try {
      const headers: Record<string, string> = {
        Authorization: this.authHeader,
        Accept: 'application/json',
        'User-Agent': 'KOVAS-App/1.0 (+https://kovas.fr)',
      }
      if (jsonBody !== undefined) headers['Content-Type'] = 'application/json'

      const res = await fetch(url, {
        method,
        headers,
        body: jsonBody !== undefined ? JSON.stringify(jsonBody) : undefined,
        signal: ctrl.signal,
      })

      const text = await res.text()
      let parsed: unknown = null
      if (text) {
        try {
          parsed = JSON.parse(text)
        } catch {
          parsed = { raw: text }
        }
      }
      return { status: res.status, body: parsed }
    } finally {
      clearTimeout(timer)
    }
  }

  private toApiError(status: number, body: unknown): QontoApiError {
    const e = body as QontoErrorResponse | null
    const first = e?.errors?.[0]
    const code = first?.code ?? e?.error ?? `http_${status}`
    const detail =
      first?.detail ?? e?.message ?? (typeof e === 'string' ? e : `Qonto HTTP ${status}`)
    return new QontoApiError(status, code, detail, body)
  }
}

function backoffMs(attempt: number): number {
  // 200, 600, 1800 ms (factor 3, jitter ±20%)
  const base = 200 * 3 ** (attempt - 1)
  const jitter = base * 0.2 * (Math.random() * 2 - 1)
  return Math.round(base + jitter)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
