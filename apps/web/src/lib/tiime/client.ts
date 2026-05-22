/**
 * Client Tiime — wrapper REST minimal pour invoice/customer.
 *
 * Tiime expose une API REST sous bearer token sur https://api.tiime.fr/v1.
 * Le périmètre exact (chemins, payload) sera à confirmer une fois la
 * documentation officielle obtenue. Ce client utilise les chemins canoniques
 * `/companies/{companyId}/invoices` qui correspondent aux conventions Tiime.
 */

import type { TiimeApiCredentials, TiimeApiResult, TiimeCustomer, TiimeInvoice } from './types'

const TIIME_BASE_URL = process.env.TIIME_API_BASE_URL ?? 'https://api.tiime.fr/v1'

export class TiimeClient {
  constructor(private readonly credentials: TiimeApiCredentials) {}

  private headers(): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.credentials.accessToken}`,
    }
  }

  private companyUrl(path: string): string {
    return `${TIIME_BASE_URL}/companies/${this.credentials.companyId}${path}`
  }

  async createCustomer(customer: TiimeCustomer): Promise<TiimeApiResult<TiimeCustomer>> {
    try {
      const res = await fetch(this.companyUrl('/customers'), {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(customer),
      })
      if (!res.ok) {
        return { ok: false, status: res.status, message: await res.text() }
      }
      const data = (await res.json()) as TiimeCustomer
      return { ok: true, status: res.status, data }
    } catch (error) {
      return { ok: false, status: 0, message: (error as Error).message }
    }
  }

  async createInvoice(invoice: TiimeInvoice): Promise<TiimeApiResult<TiimeInvoice>> {
    try {
      const res = await fetch(this.companyUrl('/invoices'), {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(invoice),
      })
      if (!res.ok) {
        return { ok: false, status: res.status, message: await res.text() }
      }
      const data = (await res.json()) as TiimeInvoice
      return { ok: true, status: res.status, data }
    } catch (error) {
      return { ok: false, status: 0, message: (error as Error).message }
    }
  }

  async ping(): Promise<TiimeApiResult<{ healthy: boolean }>> {
    try {
      const res = await fetch(this.companyUrl(''), { headers: this.headers() })
      return { ok: res.ok, status: res.status, data: { healthy: res.ok } }
    } catch (error) {
      return { ok: false, status: 0, message: (error as Error).message }
    }
  }
}
