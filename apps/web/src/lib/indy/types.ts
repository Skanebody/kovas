/**
 * Types Indy — connecteur secondaire (CLAUDE.md §17).
 *
 * Indy (https://indy.fr) — compta freemium indépendants FR. L'API publique n'est
 * pas documentée à ce jour ; ce module gère la situation "API privée" via une
 * file de demandes d'accès (table `connector_api_access_requests`). Les types
 * ci-dessous représentent une projection raisonnable que nous pourrons aligner
 * lorsque l'accès sera ouvert.
 */

export interface IndyCustomer {
  id?: string
  /** Affichage commercial (nom social ou particulier) */
  name: string
  email?: string | null
  phone?: string | null
  siret?: string | null
  address?: {
    street?: string | null
    city?: string | null
    postal_code?: string | null
    country?: string | null
  }
}

export interface IndyInvoiceLine {
  description: string
  quantity: number
  /** Prix unitaire HT en euros (Indy attend des décimaux) */
  unit_price_eur: number
  /** Taux TVA en pourcent (20, 10, 5.5, 0) */
  vat_rate: number
}

export interface IndyInvoice {
  id?: string
  reference: string
  customer_id?: string
  customer?: IndyCustomer
  issued_at: string
  due_date?: string | null
  lines: IndyInvoiceLine[]
  /** Total HT en euros (vérification redondante côté Indy) */
  total_ht_eur: number
  total_ttc_eur: number
  notes?: string | null
}

export interface IndyApiCredentials {
  apiKey: string
  /** Sous-domaine workspace optionnel — selon implémentation finale */
  workspace?: string
}

export interface IndyApiResult<T> {
  ok: boolean
  data?: T
  /** Status HTTP brut ; 501 = API privée non disponible */
  status: number
  message?: string
}
