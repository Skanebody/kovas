/**
 * KOVAS — Wrapper DVF (Demandes de Valeurs Foncières).
 *
 * Documentation officielle : https://app.dvf.etalab.gouv.fr/
 * API endpoint : https://api.cquest.org/dvf (mirroir Etalab community-maintained)
 * Coût : gratuit, sans clé.
 * Rate limit : non documenté, ~5 req/s prudent.
 *
 * Méthode : transactions immobilières publiques (mutations) dans un rayon
 *           autour d'un point (lat, lng), filtrées sur les N dernières années.
 *
 * Utilité KOVAS : estimation de valeur foncière indicative (jamais publiée au
 *                 client final, usage interne diagnostiqueur uniquement).
 *
 * Points de cassure connus :
 *   - DVF est mis à jour 2 fois/an (avril + octobre). Données récentes < 12 mois absentes.
 *   - Le format de réponse varie entre versions (resultats vs records).
 *
 * Authority : open-data-enrichments.dvf_payload.
 */

const DVF_DEFAULT_BASE_URL = 'https://api.cquest.org/dvf'

export interface DvfTransaction {
  date_mutation: string
  nature_mutation: string | null
  valeur_fonciere: number | null
  surface_reelle_bati: number | null
  nombre_pieces_principales: number | null
  type_local: string | null
  code_postal: string | null
  commune: string | null
  latitude: number | null
  longitude: number | null
}

export interface DvfPayload {
  count: number
  median_price_per_sqm: number | null
  transactions: DvfTransaction[]
  query: { latitude: number; longitude: number; radius_m: number; years: number }
  raw: unknown
}

export interface DvfFetchOptions {
  baseUrl?: string
  signal?: AbortSignal
  timeoutMs?: number
}

interface RawDvfRecord {
  date_mutation?: string
  nature_mutation?: string
  valeur_fonciere?: number | string
  surface_reelle_bati?: number | string
  nombre_pieces_principales?: number | string
  type_local?: string
  code_postal?: string
  nom_commune?: string
  lat?: number | string
  lon?: number | string
}

interface RawDvfResponse {
  resultats?: RawDvfRecord[]
  records?: RawDvfRecord[]
}

function getEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) return process.env[key]
  return undefined
}

function getBaseUrl(opts?: DvfFetchOptions): string {
  return opts?.baseUrl ?? getEnv('DVF_API_BASE_URL') ?? DVF_DEFAULT_BASE_URL
}

function toNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    const a = sorted[mid - 1] ?? 0
    const b = sorted[mid] ?? 0
    return (a + b) / 2
  }
  return sorted[mid] ?? null
}

/**
 * Cherche les transactions DVF dans un rayon donné autour d'un point.
 * @param radiusMeters défaut 500m
 * @param years défaut 5 dernières années
 */
export async function fetchDvfNearby(
  latitude: number,
  longitude: number,
  radiusMeters = 500,
  years = 5,
  opts: DvfFetchOptions = {},
): Promise<DvfPayload | null> {
  const baseUrl = getBaseUrl(opts)
  const url = new URL('/', baseUrl)
  url.searchParams.set('lat', String(latitude))
  url.searchParams.set('lon', String(longitude))
  url.searchParams.set('dist', String(radiusMeters))

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 12000)
  const signal = opts.signal ?? controller.signal

  try {
    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      signal,
      cache: 'no-store',
    })
    if (!res.ok) return null
    const data = (await res.json()) as RawDvfResponse
    const records = data.resultats ?? data.records ?? []

    const cutoffYear = new Date().getUTCFullYear() - years
    const filtered = records.filter((r) => {
      if (!r.date_mutation) return false
      const y = Number(r.date_mutation.slice(0, 4))
      return Number.isFinite(y) && y >= cutoffYear
    })

    const transactions: DvfTransaction[] = filtered.slice(0, 50).map((r) => ({
      date_mutation: r.date_mutation ?? '',
      nature_mutation: r.nature_mutation ?? null,
      valeur_fonciere: toNum(r.valeur_fonciere),
      surface_reelle_bati: toNum(r.surface_reelle_bati),
      nombre_pieces_principales: toNum(r.nombre_pieces_principales),
      type_local: r.type_local ?? null,
      code_postal: r.code_postal ?? null,
      commune: r.nom_commune ?? null,
      latitude: toNum(r.lat),
      longitude: toNum(r.lon),
    }))

    const pricesPerSqm = transactions
      .filter(
        (t) =>
          t.valeur_fonciere !== null &&
          t.surface_reelle_bati !== null &&
          t.surface_reelle_bati > 5,
      )
      .map((t) => (t.valeur_fonciere as number) / (t.surface_reelle_bati as number))

    return {
      count: transactions.length,
      median_price_per_sqm: median(pricesPerSqm),
      transactions,
      query: { latitude, longitude, radius_m: radiusMeters, years },
      raw: data,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
