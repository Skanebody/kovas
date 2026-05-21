/**
 * KOVAS — Wrapper Base Adresse Nationale (BAN).
 *
 * Documentation officielle : https://adresse.data.gouv.fr/api-doc/adresse
 * Coût : gratuit, sans clé, ~50 req/s/IP soft.
 *
 * Utilité : normalisation d'adresses + géocodage + code INSEE communal.
 * Notes :
 *   - Le helper retourne UNIQUEMENT la meilleure correspondance (score max).
 *   - Pour l'autocomplete UI on continue d'utiliser apps/web/src/lib/ban.ts (multi-results).
 *
 * Points de cassure connus :
 *   - BAN ne couvre pas systématiquement les nouveaux lotissements (< 6 mois).
 *   - Adresses avec lieu-dit sans n° → fallback type='street'.
 *
 * Authority : CLAUDE.md §3 #3 auto-complétion adresse + cadastre.
 */

const BAN_DEFAULT_BASE_URL = 'https://api-adresse.data.gouv.fr'

export interface BanNormalizedAddress {
  label: string
  housenumber: string | null
  street: string | null
  postcode: string | null
  city: string | null
  citycode: string | null // INSEE
  latitude: number
  longitude: number
  score: number
  type: 'housenumber' | 'street' | 'locality' | 'municipality'
  raw: unknown
}

export interface BanFetchOptions {
  baseUrl?: string
  signal?: AbortSignal
  timeoutMs?: number
}

interface RawBanFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: {
    label: string
    score: number
    housenumber?: string
    street?: string
    name?: string
    postcode?: string
    citycode?: string
    city?: string
    type: 'housenumber' | 'street' | 'locality' | 'municipality'
  }
}

interface RawBanResponse {
  features: RawBanFeature[]
}

function getEnv(key: string): string | undefined {
  // Compat Node + Deno (Edge Functions Supabase) : process est undefined sous Deno.
  if (typeof process !== 'undefined' && process.env) return process.env[key]
  return undefined
}

function getBaseUrl(opts?: BanFetchOptions): string {
  return opts?.baseUrl ?? getEnv('BAN_API_BASE_URL') ?? BAN_DEFAULT_BASE_URL
}

/**
 * Géocode une adresse libre — retourne la meilleure correspondance (score max)
 * ou `null` si aucune feature pertinente (score < 0.3).
 */
export async function geocodeBanAddress(
  rawAddress: string,
  opts: BanFetchOptions = {},
): Promise<BanNormalizedAddress | null> {
  if (!rawAddress || rawAddress.trim().length < 3) return null

  const baseUrl = getBaseUrl(opts)
  const url = new URL('/search/', baseUrl)
  url.searchParams.set('q', rawAddress)
  url.searchParams.set('limit', '1')
  url.searchParams.set('autocomplete', '0')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 8000)
  const signal = opts.signal ?? controller.signal

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal,
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as RawBanResponse
    const best = data.features?.[0]
    if (!best || best.properties.score < 0.3) return null

    const [lng, lat] = best.geometry.coordinates
    return {
      label: best.properties.label,
      housenumber: best.properties.housenumber ?? null,
      street: best.properties.street ?? best.properties.name ?? null,
      postcode: best.properties.postcode ?? null,
      city: best.properties.city ?? null,
      citycode: best.properties.citycode ?? null,
      latitude: lat,
      longitude: lng,
      score: best.properties.score,
      type: best.properties.type,
      raw: best,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
