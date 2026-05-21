/**
 * KOVAS — Wrapper Référentiel National des Bâtiments (RNB).
 *
 * Documentation officielle : https://rnb.beta.gouv.fr/api/alpha
 * API endpoint : https://rnb-api.beta.gouv.fr/api/alpha/buildings
 * Coût : gratuit, sans clé (état alpha mai 2026, API publique).
 *
 * Méthode : recherche par point WGS84 (lng, lat) → identifiant unique RNB
 *           du bâtiment (12 caractères) + statut + coordonnées centroid.
 *
 * Points de cassure connus :
 *   - API en version alpha : breaking changes possibles d'ici fin 2026.
 *   - Bâtiments en cours de référencement → status='constructionProposed'.
 *
 * Authority : open-data-enrichments.rnb_payload.
 */

const RNB_DEFAULT_BASE_URL = 'https://rnb-api.beta.gouv.fr'

export interface RnbBuilding {
  rnb_id: string
  status: string | null
  latitude: number | null
  longitude: number | null
  ext_ids: unknown
  raw: unknown
}

export interface RnbFetchOptions {
  baseUrl?: string
  signal?: AbortSignal
  timeoutMs?: number
}

interface RawRnbBuilding {
  rnb_id?: string
  status?: string
  point?: { type: string; coordinates: [number, number] }
  ext_ids?: unknown
}

interface RawRnbResponse {
  results?: RawRnbBuilding[]
}

function getEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) return process.env[key]
  return undefined
}

function getBaseUrl(opts?: RnbFetchOptions): string {
  return opts?.baseUrl ?? getEnv('RNB_API_BASE_URL') ?? RNB_DEFAULT_BASE_URL
}

/**
 * Récupère le RNB ID du bâtiment intersectant (ou le plus proche de) le point.
 * Retourne null si aucun bâtiment.
 */
export async function fetchRnbIdByPoint(
  longitude: number,
  latitude: number,
  opts: RnbFetchOptions = {},
): Promise<RnbBuilding | null> {
  const baseUrl = getBaseUrl(opts)
  const url = new URL('/api/alpha/buildings/', baseUrl)
  url.searchParams.set('point', `${longitude},${latitude}`)
  url.searchParams.set('page_size', '1')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10000)
  const signal = opts.signal ?? controller.signal

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal,
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as RawRnbResponse
    const b = data.results?.[0]
    if (!b?.rnb_id) return null
    const coords = b.point?.coordinates ?? null
    return {
      rnb_id: b.rnb_id,
      status: b.status ?? null,
      longitude: coords ? coords[0] : null,
      latitude: coords ? coords[1] : null,
      ext_ids: b.ext_ids ?? null,
      raw: b,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
