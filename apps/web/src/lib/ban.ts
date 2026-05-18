/**
 * Wrapper API Base Adresse Nationale (BAN) — api-adresse.data.gouv.fr
 * Gratuit, sans clé, ~50 req/s/IP, ~5 req/s soft.
 */

export interface BanFeature {
  type: 'Feature'
  geometry: { type: 'Point'; coordinates: [number, number] }
  properties: {
    label: string
    score: number
    housenumber?: string
    name?: string
    postcode?: string
    citycode?: string
    city?: string
    type: 'housenumber' | 'street' | 'locality' | 'municipality'
    importance?: number
    context?: string
    x?: number
    y?: number
  }
}

interface BanResponse {
  features: BanFeature[]
}

/**
 * Recherche d'adresses. Renvoie au plus `limit` features triées par score.
 * @param query au moins 3 caractères
 */
export async function searchBanAddress(query: string, limit = 6): Promise<BanFeature[]> {
  if (!query || query.trim().length < 3) return []
  const url = new URL('https://api-adresse.data.gouv.fr/search/')
  url.searchParams.set('q', query)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('autocomplete', '1')

  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' })
    if (!res.ok) return []
    const data = (await res.json()) as BanResponse
    return data.features ?? []
  } catch {
    return []
  }
}
