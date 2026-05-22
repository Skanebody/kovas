/**
 * Client Indy — stub gracieux tant que l'API n'est pas publique.
 *
 * Tant qu'Indy n'a pas ouvert son API, toutes les opérations retournent un
 * résultat 501 (Not Implemented) avec une instruction claire pour demander
 * l'accès. La page d'intégration affiche un CTA "Demander l'accès" qui crée
 * une ligne dans `connector_api_access_requests`.
 *
 * Quand Indy publiera son API, remplacer le corps de chaque méthode par les
 * fetch correspondants (bearer token, base URL à confirmer).
 */

import type { IndyApiCredentials, IndyApiResult, IndyCustomer, IndyInvoice } from './types'

// Réservé : à confirmer auprès d'Indy lorsque l'API sera publique.
const INDY_BASE_URL = process.env.INDY_API_BASE_URL ?? 'https://api.indy.fr/v1'

function isApiEnabled(): boolean {
  return Boolean(process.env.INDY_API_PUBLIC_AVAILABLE === 'true')
}

function notImplemented<T>(action: string): IndyApiResult<T> {
  return {
    ok: false,
    status: 501,
    message: `API Indy non disponible publiquement pour l'action "${action}". Demandez l'accès depuis Compte → Intégrations → Indy.`,
  }
}

export class IndyClient {
  constructor(private readonly credentials: IndyApiCredentials) {}

  private headers(): Record<string, string> {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.credentials.apiKey}`,
    }
  }

  async createCustomer(customer: IndyCustomer): Promise<IndyApiResult<IndyCustomer>> {
    if (!isApiEnabled()) return notImplemented<IndyCustomer>('createCustomer')
    try {
      const res = await fetch(`${INDY_BASE_URL}/customers`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(customer),
      })
      if (!res.ok) {
        return { ok: false, status: res.status, message: await res.text() }
      }
      const data = (await res.json()) as IndyCustomer
      return { ok: true, status: res.status, data }
    } catch (error) {
      return { ok: false, status: 0, message: (error as Error).message }
    }
  }

  async createInvoice(invoice: IndyInvoice): Promise<IndyApiResult<IndyInvoice>> {
    if (!isApiEnabled()) return notImplemented<IndyInvoice>('createInvoice')
    try {
      const res = await fetch(`${INDY_BASE_URL}/invoices`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(invoice),
      })
      if (!res.ok) {
        return { ok: false, status: res.status, message: await res.text() }
      }
      const data = (await res.json()) as IndyInvoice
      return { ok: true, status: res.status, data }
    } catch (error) {
      return { ok: false, status: 0, message: (error as Error).message }
    }
  }

  async ping(): Promise<IndyApiResult<{ healthy: boolean }>> {
    if (!isApiEnabled()) return notImplemented<{ healthy: boolean }>('ping')
    try {
      const res = await fetch(`${INDY_BASE_URL}/health`, { headers: this.headers() })
      return { ok: res.ok, status: res.status, data: { healthy: res.ok } }
    } catch (error) {
      return { ok: false, status: 0, message: (error as Error).message }
    }
  }
}
