/**
 * Reverse geocoding via API Base Adresse Nationale (BAN).
 * https://api-adresse.data.gouv.fr/reverse/?lon=<lng>&lat=<lat>
 *
 * Cache mémoire 24h pour éviter de retomber sur la même requête après un re-render.
 */

export interface ReverseGeocodeResult {
  city: string
  postal: string
  label: string
  street?: string
  insee?: string
}

interface BanReverseFeature {
  properties: {
    label: string
    name?: string
    postcode?: string
    city?: string
    citycode?: string
  }
}

interface BanReverseResponse {
  features?: BanReverseFeature[]
}

interface CacheEntry {
  value: ReverseGeocodeResult | null
  expiresAt: number
}

const CACHE = new Map<string, CacheEntry>()
const TTL_MS = 24 * 60 * 60 * 1000 // 24h

function cacheKey(lat: number, lng: number): string {
  // Précision ~10m via 4 décimales (suffisant pour un cabinet à la même adresse)
  return `${lat.toFixed(4)}|${lng.toFixed(4)}`
}

export async function reverseGeocodeBAN(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const key = cacheKey(lat, lng)
  const cached = CACHE.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value
  }

  try {
    const url = new URL('https://api-adresse.data.gouv.fr/reverse/')
    url.searchParams.set('lon', String(lng))
    url.searchParams.set('lat', String(lat))
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) {
      CACHE.set(key, { value: null, expiresAt: Date.now() + 5 * 60 * 1000 })
      return null
    }
    const data = (await res.json()) as BanReverseResponse
    const first = data.features?.[0]
    if (!first) {
      CACHE.set(key, { value: null, expiresAt: Date.now() + 5 * 60 * 1000 })
      return null
    }
    const result: ReverseGeocodeResult = {
      label: first.properties.label,
      city: first.properties.city ?? '',
      postal: first.properties.postcode ?? '',
      street: first.properties.name,
      insee: first.properties.citycode,
    }
    CACHE.set(key, { value: result, expiresAt: Date.now() + TTL_MS })
    return result
  } catch {
    return null
  }
}
