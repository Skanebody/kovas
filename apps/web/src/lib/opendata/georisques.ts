/**
 * KOVAS — Wrapper Géorisques (georisques.gouv.fr).
 *
 * Documentation officielle : https://www.georisques.gouv.fr/doc-api
 * Base URL : https://www.georisques.gouv.fr/api/v1
 * Coût : gratuit, sans clé.
 * Rate limit : ~5 req/s (soft).
 *
 * Endpoints utilisés (V1) :
 *   - /gaspar/risques?code_insee=...     → risques naturels/technologiques par commune
 *   - /radon?code_insee=...              → potentiel radon (niveau 1/2/3)
 *   - /retrait-gonflement-argile?lat&lng → aléa argile (faible/moyen/fort)
 *   - /sismique?code_insee=...           → zone sismique 1-5
 *
 * Utilité KOVAS : alimentation automatique du diagnostic ERP (État des Risques
 *                 et Pollutions, ex-ERNMT), arrêtés préfectoraux applicables.
 *
 * Points de cassure connus :
 *   - L'API renvoie 404 pour les communes < 50 habitants (non documenté).
 *   - Le payload retrait-gonflement varie selon la disponibilité cartographique.
 *
 * Authority : CLAUDE.md §3 #3 (Géorisques ERP) + open-data-enrichments.
 */

const GEORISQUES_DEFAULT_BASE_URL = 'https://www.georisques.gouv.fr/api/v1'

export interface GeorisquesPayload {
  code_insee: string
  risques_naturels: unknown[]
  risques_technologiques: unknown[]
  zone_sismique: number | null
  potentiel_radon: number | null
  alea_argile: string | null
  ppr_applicables: unknown[]
  arretes_recents: unknown[]
  raw: Record<string, unknown>
}

export interface GeorisquesFetchOptions {
  baseUrl?: string
  signal?: AbortSignal
  timeoutMs?: number
}

interface GenericObj {
  data?: unknown[]
  results?: unknown[]
}

function getEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) return process.env[key]
  return undefined
}

function getBaseUrl(opts?: GeorisquesFetchOptions): string {
  return opts?.baseUrl ?? getEnv('GEORISQUES_API_BASE_URL') ?? GEORISQUES_DEFAULT_BASE_URL
}

async function safeFetchJson(
  url: string,
  signal: AbortSignal,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal,
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

function arrayOf(v: unknown): unknown[] {
  if (Array.isArray(v)) return v
  if (v && typeof v === 'object') {
    const o = v as GenericObj
    if (Array.isArray(o.data)) return o.data
    if (Array.isArray(o.results)) return o.results
  }
  return []
}

/**
 * Récupère un agrégat Géorisques pour une commune (code INSEE) et un point
 * (lat, lng) pour les requêtes géographiques (argile). Best-effort, retourne
 * une structure même si certains sous-appels échouent.
 */
export async function fetchGeorisquesByLocation(
  codeInsee: string,
  latitude: number | null,
  longitude: number | null,
  opts: GeorisquesFetchOptions = {},
): Promise<GeorisquesPayload | null> {
  if (!codeInsee) return null
  const baseUrl = getBaseUrl(opts)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12000)
  const signal = opts.signal ?? controller.signal

  try {
    const [gaspar, radon, sismique, argile] = await Promise.all([
      safeFetchJson(`${baseUrl}/gaspar/risques?code_insee=${codeInsee}`, signal),
      safeFetchJson(`${baseUrl}/radon?code_insee=${codeInsee}`, signal),
      safeFetchJson(`${baseUrl}/zonage_sismique?code_insee=${codeInsee}`, signal),
      latitude !== null && longitude !== null
        ? safeFetchJson(
            `${baseUrl}/retrait-gonflement-argile?latlon=${latitude},${longitude}`,
            signal,
          )
        : Promise.resolve(null),
    ])

    const risquesAll = arrayOf(gaspar?.['risques']) as Array<Record<string, unknown>>
    const risquesNaturels = risquesAll.filter((r) => r['type_risque'] === 'naturel')
    const risquesTechno = risquesAll.filter((r) => r['type_risque'] === 'technologique')
    const ppr = arrayOf(gaspar?.['ppr'])
    const arretes = arrayOf(gaspar?.['arretes_cat_nat']).slice(0, 10)

    return {
      code_insee: codeInsee,
      risques_naturels: risquesNaturels,
      risques_technologiques: risquesTechno,
      zone_sismique:
        typeof sismique?.['zone_sismicite'] === 'number'
          ? (sismique['zone_sismicite'] as number)
          : null,
      potentiel_radon:
        typeof radon?.['classe_potentiel'] === 'number'
          ? (radon['classe_potentiel'] as number)
          : null,
      alea_argile:
        typeof argile?.['exposition'] === 'string' ? (argile['exposition'] as string) : null,
      ppr_applicables: ppr,
      arretes_recents: arretes,
      raw: { gaspar, radon, sismique, argile },
    }
  } finally {
    clearTimeout(timeout)
  }
}
