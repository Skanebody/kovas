/**
 * Client RNB — Référentiel National des Bâtiments
 * (beta.gouv / Cerema-IGN, open data Licence Etalab 2.0).
 *
 *   - Base   : https://rnb-api.beta.gouv.fr/api/alpha/buildings/
 *   - Auth   : optionnelle (token augmente quotas, pas requis V1)
 *   - Rate   : recommandé < 10 req/s
 *   - Cache  : 30j en table Supabase `rnb_cache` (les bâtiments changent peu)
 *
 * Erreurs : toujours typées `RnbApiError`. Aucune dépendance Supabase côté
 * client par défaut — on passe un `cacheStore` injecté pour rester testable.
 */

import { searchBanAddress } from '@/lib/ban'
import { type BanAddressInput, RnbApiError, type RnbBuilding, type RnbBuildingList } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const RNB_BASE_URL = 'https://rnb-api.beta.gouv.fr/api/alpha'
const DEFAULT_TIMEOUT_MS = 5_000
/** TTL applicatif du cache — les bâtiments changent peu. */
export const RNB_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1_000 // 30 jours

// ─────────────────────────────────────────────────────────────────────────────
// CacheStore — interface injectable (Supabase en prod, in-memory en test)
// ─────────────────────────────────────────────────────────────────────────────

export interface RnbCacheRow {
  rnb_id: string
  raw_data: RnbBuilding
  bdnb_enrichment: unknown
  fetched_at: string
  bdnb_fetched_at: string | null
}

export interface RnbCacheStore {
  getByRnbId(rnbId: string): Promise<RnbCacheRow | null>
  getByPoint(lng: number, lat: number, radiusMeters: number): Promise<RnbCacheRow | null>
  upsert(row: { rnb_id: string; lng: number; lat: number; raw_data: RnbBuilding }): Promise<void>
}

/** Cache no-op (tests + dev sans Supabase). */
export const NO_OP_CACHE: RnbCacheStore = {
  async getByRnbId() {
    return null
  },
  async getByPoint() {
    return null
  },
  async upsert() {
    /* noop */
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch wrapper : timeout + retry exponentiel + erreurs typées
// ─────────────────────────────────────────────────────────────────────────────

interface FetchOptions {
  timeoutMs?: number
  /** Nombre total de tentatives (retry inclus). 2 = 1 essai + 1 retry. */
  maxAttempts?: number
  /** Permet d'injecter un fetch custom (tests). */
  fetchImpl?: typeof fetch
}

async function rnbFetch<T>(url: string, opts: FetchOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxAttempts = 2, fetchImpl = fetch } = opts

  let lastError: RnbApiError | null = null

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
        throw new RnbApiError('not_found', `RNB 404: ${url}`, 404)
      }
      if (res.status === 429) {
        throw new RnbApiError('rate_limit', 'RNB rate limit reached', 429)
      }
      if (res.status >= 500) {
        // Retry sur 5xx
        lastError = new RnbApiError('server_error', `RNB ${res.status}`, res.status)
        if (attempt < maxAttempts) {
          await sleep(backoffMs(attempt))
          continue
        }
        throw lastError
      }
      if (!res.ok) {
        throw new RnbApiError('network', `RNB ${res.status} ${res.statusText}`, res.status)
      }

      try {
        return (await res.json()) as T
      } catch {
        throw new RnbApiError('parse', 'RNB JSON parse failed')
      }
    } catch (err) {
      clearTimeout(timer)
      if (err instanceof RnbApiError) {
        // Erreurs non-retry → fail fast.
        if (err.code !== 'server_error') throw err
        lastError = err
        if (attempt < maxAttempts) {
          await sleep(backoffMs(attempt))
          continue
        }
        throw lastError
      }
      // AbortError / TypeError réseau
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new RnbApiError('timeout', `RNB timeout (${timeoutMs}ms)`)
      } else {
        const msg = err instanceof Error ? err.message : 'unknown'
        lastError = new RnbApiError('network', `RNB network error: ${msg}`)
      }
      if (attempt < maxAttempts) {
        await sleep(backoffMs(attempt))
        continue
      }
      throw lastError
    }
  }

  // Garde-fou (théoriquement inatteignable)
  throw lastError ?? new RnbApiError('network', 'RNB unknown error')
}

function backoffMs(attempt: number): number {
  // 250ms, 750ms, 2.25s...
  return 250 * 3 ** (attempt - 1)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers cache (lecture avec TTL)
// ─────────────────────────────────────────────────────────────────────────────

function isCacheFresh(fetchedAt: string): boolean {
  const fetched = Date.parse(fetchedAt)
  if (Number.isNaN(fetched)) return false
  return Date.now() - fetched < RNB_CACHE_TTL_MS
}

// ─────────────────────────────────────────────────────────────────────────────
// API publique
// ─────────────────────────────────────────────────────────────────────────────

export interface RnbClientOptions extends FetchOptions {
  cache?: RnbCacheStore
}

/**
 * Géocodage inverse RNB : retourne le bâtiment le plus proche d'un point WGS84.
 *
 * Stratégie :
 *   1. Lookup cache spatial (rayon 20 m, TTL 30j).
 *   2. Sinon GET RNB `?point={lng},{lat}` → premier résultat.
 *   3. Persiste en cache si trouvé.
 *
 * Retourne `null` si aucun bâtiment trouvé (rare en zone urbaine, possible
 * en zone rurale isolée).
 */
export async function lookupByPoint(
  lat: number,
  lng: number,
  opts: RnbClientOptions = {},
): Promise<RnbBuilding | null> {
  const cache = opts.cache ?? NO_OP_CACHE

  // 1. Cache spatial (20m de rayon, ce qui est largement plus serré qu'une
  // emprise bâtiment moyenne et évite les faux positifs sur copropriétés mitoyennes).
  const cached = await cache.getByPoint(lng, lat, 20)
  if (cached && isCacheFresh(cached.fetched_at)) {
    return cached.raw_data
  }

  // 2. Appel API RNB. L'endpoint accepte `?point=lng,lat`.
  const url = new URL(`${RNB_BASE_URL}/buildings/`)
  url.searchParams.set('point', `${lng.toFixed(7)},${lat.toFixed(7)}`)

  try {
    const data = await rnbFetch<RnbBuildingList>(url.toString(), opts)
    const building = data.results?.[0] ?? null
    if (!building) return null

    // 3. Persistance cache (fire-and-forget côté UX, mais await ici pour tests
    // déterministes — la latence est négligeable).
    await safeUpsertCache(cache, building, lng, lat)
    return building
  } catch (err) {
    if (err instanceof RnbApiError && err.code === 'not_found') return null
    throw err
  }
}

/**
 * Récupère une fiche RNB par son identifiant (12 caractères alphanum).
 */
export async function lookupById(
  rnbId: string,
  opts: RnbClientOptions = {},
): Promise<RnbBuilding | null> {
  if (!rnbId || rnbId.length < 8) {
    throw new RnbApiError('parse', `Invalid RNB ID: ${rnbId}`)
  }

  const cache = opts.cache ?? NO_OP_CACHE

  const cached = await cache.getByRnbId(rnbId)
  if (cached && isCacheFresh(cached.fetched_at)) {
    return cached.raw_data
  }

  const url = `${RNB_BASE_URL}/buildings/${encodeURIComponent(rnbId)}/`

  try {
    const building = await rnbFetch<RnbBuilding>(url, opts)
    if (!building?.rnb_id) return null

    const coords = building.point?.coordinates
    if (coords) {
      await safeUpsertCache(cache, building, coords[0], coords[1])
    }
    return building
  } catch (err) {
    if (err instanceof RnbApiError && err.code === 'not_found') return null
    throw err
  }
}

/**
 * Lookup d'un bâtiment à partir d'une adresse BAN.
 *
 * Si l'adresse contient déjà des coordonnées (cas du composant
 * AddressAutocomplete qui propage `longitude`/`latitude`), on saute le geocoding
 * BAN et on appelle directement `lookupByPoint`. Sinon on geocode via BAN puis
 * on appelle `lookupByPoint`.
 */
export async function lookupByAddress(
  address: BanAddressInput,
  opts: RnbClientOptions = {},
): Promise<RnbBuilding | null> {
  if (typeof address.latitude === 'number' && typeof address.longitude === 'number') {
    return lookupByPoint(address.latitude, address.longitude, opts)
  }

  if (!address.label) {
    throw new RnbApiError('parse', 'BAN address requires label or coordinates')
  }

  // Fallback : geocoding BAN si label seul.
  const features = await searchBanAddress(address.label, 1)
  const first = features[0]
  if (!first) return null
  const [lng, lat] = first.geometry.coordinates
  return lookupByPoint(lat, lng, opts)
}

// ─────────────────────────────────────────────────────────────────────────────
// Internals
// ─────────────────────────────────────────────────────────────────────────────

async function safeUpsertCache(
  cache: RnbCacheStore,
  building: RnbBuilding,
  lng: number,
  lat: number,
): Promise<void> {
  try {
    await cache.upsert({ rnb_id: building.rnb_id, lng, lat, raw_data: building })
  } catch {
    // Le cache est best-effort : l'utilisateur n'a pas à voir une erreur cache.
  }
}
