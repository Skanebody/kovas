/**
 * Client BDNB CSTB — Base de Données Nationale des Bâtiments.
 * Subset Open (gratuit, ODbL, sans clé). Subset Open Plus / Expert nécessitent
 * inscription mais ne sont pas utilisés en Phase 1.
 *
 *   - Base   : https://api-portail.bdnb.io/v2.0/donnees
 *   - Pivot  : `batiment_groupe_id` ← égal au `rnb_id` (depuis 2024)
 *   - Cache  : 30j sur table `rnb_cache.bdnb_enrichment` (mêmes données que RNB)
 *
 * Le schéma BDNB est volumineux (200+ datasets). On ne consomme que les colonnes
 * "carte d'identité bâtiment" utiles au pré-remplissage mission. Le reste est
 * stocké brut dans `bdnb_enrichment` JSONB pour exploitation future.
 */

import type { RnbCacheRow, RnbCacheStore } from './rnb-client'
import { BdnbApiError, type BdnbEnrichment } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const BDNB_BASE_URL = 'https://api-portail.bdnb.io/v2.0/donnees'
const DEFAULT_TIMEOUT_MS = 5_000
export const BDNB_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1_000 // 30j

// ─────────────────────────────────────────────────────────────────────────────
// CacheStore additionnel pour l'enrichissement BDNB
// ─────────────────────────────────────────────────────────────────────────────

export interface BdnbCacheStore extends RnbCacheStore {
  setBdnbEnrichment(rnbId: string, enrichment: BdnbEnrichment): Promise<void>
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch wrapper (mêmes garanties que RNB : timeout + retry + erreurs typées)
// ─────────────────────────────────────────────────────────────────────────────

interface FetchOptions {
  timeoutMs?: number
  maxAttempts?: number
  fetchImpl?: typeof fetch
}

async function bdnbFetch<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxAttempts = 2, fetchImpl = fetch } = opts

  let lastError: BdnbApiError | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetchImpl(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'KOVAS-App/1.0 (+https://kovas.fr)',
        },
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (res.status === 404) {
        throw new BdnbApiError('not_found', `BDNB 404: ${url}`, 404)
      }
      if (res.status === 429) {
        throw new BdnbApiError('rate_limit', 'BDNB rate limit reached', 429)
      }
      if (res.status >= 500) {
        lastError = new BdnbApiError('server_error', `BDNB ${res.status}`, res.status)
        if (attempt < maxAttempts) {
          await sleep(backoffMs(attempt))
          continue
        }
        throw lastError
      }
      if (!res.ok) {
        throw new BdnbApiError('network', `BDNB ${res.status} ${res.statusText}`, res.status)
      }

      try {
        return (await res.json()) as T
      } catch {
        throw new BdnbApiError('parse', 'BDNB JSON parse failed')
      }
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof BdnbApiError) {
        if (err.code !== 'server_error') throw err
        lastError = err
        if (attempt < maxAttempts) {
          await sleep(backoffMs(attempt))
          continue
        }
        throw lastError
      }
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new BdnbApiError('timeout', `BDNB timeout (${timeoutMs}ms)`)
      } else {
        const msg = err instanceof Error ? err.message : 'unknown'
        lastError = new BdnbApiError('network', `BDNB network error: ${msg}`)
      }
      if (attempt < maxAttempts) {
        await sleep(backoffMs(attempt))
        continue
      }
      throw lastError
    }
  }

  throw lastError ?? new BdnbApiError('network', 'BDNB unknown error')
}

function backoffMs(attempt: number): number {
  return 250 * 3 ** (attempt - 1)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─────────────────────────────────────────────────────────────────────────────
// API publique
// ─────────────────────────────────────────────────────────────────────────────

export interface BdnbClientOptions extends FetchOptions {
  cache?: BdnbCacheStore
}

interface BdnbCollectionResponse {
  // L'API BDNB v2.0 expose un endpoint REST PostgREST-like. Le payload est soit
  // un tableau direct, soit un objet `{ data: [...] }` selon le dataset.
  data?: BdnbEnrichment[]
  results?: BdnbEnrichment[]
  count?: number
}

/**
 * Récupère l'enrichissement BDNB pour un bâtiment, identifié par son RNB ID
 * (qui sert de `batiment_groupe_id` côté BDNB depuis 2024).
 *
 * Retourne `null` si BDNB n'a aucune observation pour ce bâtiment (les datasets
 * Open couvrent ~28M bâtiments sur les ~32M existants).
 *
 * Stratégie cache identique à RNB : lookup → fetch → upsert.
 */
export async function enrichBuilding(
  rnbId: string,
  opts: BdnbClientOptions = {},
): Promise<BdnbEnrichment | null> {
  if (!rnbId) {
    throw new BdnbApiError('parse', 'Empty RNB ID')
  }

  const cache = opts.cache

  // Cache hit (BDNB stocké sur la même row que RNB).
  if (cache) {
    const cached = await cache.getByRnbId(rnbId)
    if (cached && isBdnbCached(cached)) {
      return cached.bdnb_enrichment as BdnbEnrichment
    }
  }

  // Le dataset Open "batiment_groupe" expose les colonnes de base. On utilise
  // un filtre `eq.{rnbId}` PostgREST-style. Si le schéma évolue, le parse JSON
  // reste robuste car BdnbEnrichment a tous ses champs optionnels.
  const url = new URL(`${BDNB_BASE_URL}/batiment_groupe/`)
  url.searchParams.set('batiment_groupe_id', `eq.${rnbId}`)
  url.searchParams.set('limit', '1')

  let payload: BdnbCollectionResponse | BdnbEnrichment[]
  try {
    payload = await bdnbFetch<BdnbCollectionResponse | BdnbEnrichment[]>(url.toString(), opts)
  } catch (err) {
    if (err instanceof BdnbApiError && err.code === 'not_found') return null
    throw err
  }

  const enrichment = extractFirstEnrichment(payload)
  if (!enrichment) return null

  if (cache) {
    try {
      await cache.setBdnbEnrichment(rnbId, enrichment)
    } catch {
      // Cache best-effort.
    }
  }

  return enrichment
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

function extractFirstEnrichment(
  payload: BdnbCollectionResponse | BdnbEnrichment[],
): BdnbEnrichment | null {
  if (Array.isArray(payload)) return payload[0] ?? null
  if (payload.data && payload.data.length > 0) return payload.data[0] ?? null
  if (payload.results && payload.results.length > 0) return payload.results[0] ?? null
  return null
}

function isBdnbCached(row: RnbCacheRow): boolean {
  if (!row.bdnb_enrichment || !row.bdnb_fetched_at) return false
  const fetched = Date.parse(row.bdnb_fetched_at)
  if (Number.isNaN(fetched)) return false
  return Date.now() - fetched < BDNB_CACHE_TTL_MS
}
