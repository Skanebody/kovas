/**
 * KOVAS — Wrapper Cadastre IGN (apicarto.ign.fr).
 *
 * Documentation officielle : https://apicarto.ign.fr/api/doc/cadastre
 * Coût : gratuit, sans clé.
 * Rate limit : non documenté strictement, ~5 req/s prudent.
 *
 * Méthode : POINT(lng lat) WGS84 → parcelle cadastrale (prefix/section/numero + surface).
 *
 * Points de cassure connus :
 *   - Parcelles non cadastrées (DOM-TOM partiel, certains lotissements neufs).
 *   - Adresse pointant entre deux parcelles → la 1re intersectée est retournée.
 *
 * Authority : CLAUDE.md §3 #3 + open-data-enrichments table.
 */

const CADASTRE_DEFAULT_BASE_URL = 'https://apicarto.ign.fr'

export interface CadastreParcel {
  parcelle_id: string // id unique IGN (ex: 760001000AB0123)
  code_insee: string
  prefixe: string
  section: string
  numero: string
  surface_m2: number | null
  geometry: unknown // GeoJSON Polygon
  raw: unknown
}

export interface CadastreFetchOptions {
  baseUrl?: string
  signal?: AbortSignal
  timeoutMs?: number
}

interface RawParcelFeature {
  type: 'Feature'
  geometry: unknown
  properties: {
    idu?: string
    code_insee?: string
    prefixe?: string
    section?: string
    numero?: string
    contenance?: number
  }
}

interface RawCadastreResponse {
  features?: RawParcelFeature[]
}

function getEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) return process.env[key]
  return undefined
}

function getBaseUrl(opts?: CadastreFetchOptions): string {
  return opts?.baseUrl ?? getEnv('CADASTRE_API_BASE_URL') ?? CADASTRE_DEFAULT_BASE_URL
}

/**
 * Récupère la parcelle cadastrale intersectant le point WGS84 (lng, lat).
 * Retourne `null` si aucune parcelle trouvée.
 */
export async function fetchCadastreParcelByPoint(
  longitude: number,
  latitude: number,
  opts: CadastreFetchOptions = {},
): Promise<CadastreParcel | null> {
  const baseUrl = getBaseUrl(opts)
  const url = new URL('/api/cadastre/parcelle', baseUrl)
  url.searchParams.set(
    'geom',
    JSON.stringify({ type: 'Point', coordinates: [longitude, latitude] }),
  )
  url.searchParams.set('_limit', '1')

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
    const data = (await res.json()) as RawCadastreResponse
    const feat = data.features?.[0]
    if (!feat) return null

    return {
      parcelle_id: feat.properties.idu ?? '',
      code_insee: feat.properties.code_insee ?? '',
      prefixe: feat.properties.prefixe ?? '',
      section: feat.properties.section ?? '',
      numero: feat.properties.numero ?? '',
      surface_m2: feat.properties.contenance ?? null,
      geometry: feat.geometry,
      raw: feat,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
