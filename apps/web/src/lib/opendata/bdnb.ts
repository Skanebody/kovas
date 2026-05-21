/**
 * KOVAS — Wrapper Base de Données Nationale des Bâtiments (BDNB / CSTB).
 *
 * Documentation officielle : https://bdnb.io/documentation
 * Coût : API publique gratuite (data.gouv.fr), accès lecture sans clé pour les
 *        endpoints documentaires de base. Endpoint enrichi BDNB+ → clé optionnelle
 *        (BDNB_API_KEY non requis en V1).
 *
 * Méthode : recherche par (longitude, latitude) → bâtiment intersecté + caractéristiques
 *           thermiques (étiquette DPE théorique CSTB, matériaux probables, période const.).
 *
 * Points de cassure connus :
 *   - L'identifiant bâtiment_groupe_id de la BDNB peut changer entre millésimes.
 *   - Endpoint principal : https://api.bdnb.io/v1/bdnb/batiment_groupe?on_point=...
 *   - TODO : si l'API exige une clé en prod (rate limit), ajouter `BDNB_API_KEY`
 *            et passer `Authorization: Bearer <key>`.
 *
 * Authority : open-data-enrichments table.
 */

const BDNB_DEFAULT_BASE_URL = 'https://api.bdnb.io'

export interface BdnbBuilding {
  batiment_groupe_id: string | null
  classe_bilan_dpe: string | null // A-G théorique CSTB (peut différer du DPE réel)
  annee_construction: number | null
  type_dpe: string | null
  usage_principal: string | null
  surface_emprise_sol: number | null
  raw: unknown
}

export interface BdnbFetchOptions {
  baseUrl?: string
  apiKey?: string
  signal?: AbortSignal
  timeoutMs?: number
}

interface RawBdnbItem {
  batiment_groupe_id?: string
  classe_bilan_dpe?: string
  annee_construction?: number
  type_dpe?: string
  usage_principal?: string
  s_geom_groupe?: number
}

function getEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) return process.env[key]
  return undefined
}

function getBaseUrl(opts?: BdnbFetchOptions): string {
  return opts?.baseUrl ?? getEnv('BDNB_API_BASE_URL') ?? BDNB_DEFAULT_BASE_URL
}

/**
 * Récupère le bâtiment BDNB principal sur un point (lng, lat) WGS84.
 * Retourne null si aucun résultat ou en cas d'erreur réseau (best-effort).
 */
export async function fetchBdnbBuildingByPoint(
  longitude: number,
  latitude: number,
  opts: BdnbFetchOptions = {},
): Promise<BdnbBuilding | null> {
  const baseUrl = getBaseUrl(opts)
  const url = new URL('/v1/bdnb/batiment_groupe', baseUrl)
  url.searchParams.set('on_point', `${longitude},${latitude}`)
  url.searchParams.set('limit', '1')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10000)
  const signal = opts.signal ?? controller.signal

  const headers: Record<string, string> = { Accept: 'application/json' }
  const apiKey = opts.apiKey ?? getEnv('BDNB_API_KEY')
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  try {
    const res = await fetch(url.toString(), { headers, signal, cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as RawBdnbItem[] | { results?: RawBdnbItem[] }
    const arr = Array.isArray(data) ? data : (data.results ?? [])
    const item = arr[0]
    if (!item) return null
    return {
      batiment_groupe_id: item.batiment_groupe_id ?? null,
      classe_bilan_dpe: item.classe_bilan_dpe ?? null,
      annee_construction: item.annee_construction ?? null,
      type_dpe: item.type_dpe ?? null,
      usage_principal: item.usage_principal ?? null,
      surface_emprise_sol: item.s_geom_groupe ?? null,
      raw: item,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
