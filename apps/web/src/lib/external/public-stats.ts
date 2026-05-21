import 'server-only'

/**
 * Public Local Stats — agrégation de 3 sources gouvernementales gratuites
 * pour le contexte commercial d'un bien (page property V5).
 *
 * Sources (toutes gratuites, sans clé API) :
 *   1. DVF — Demandes de Valeurs Foncières — Etalab/DGFiP (data.gouv.fr)
 *      → prix médian €/m² sur les 2 dernières années
 *   2. geo.api.gouv.fr — proxy INSEE pour population commune
 *   3. ADEME — Open Data DPE existants — count par commune
 *
 * Cache : Next.js `revalidate` 24h pour DVF/ADEME, 7j pour population.
 * Cache mémoire process-local fallback pour les rechargements répétés.
 */

export interface LocalStats {
  /** Prix médian DVF €/m² (entier arrondi) ou null si données insuffisantes */
  dvfMedianEurM2: number | null
  /** Population INSEE de la commune ou null */
  inseePopulation: number | null
  /** Nombre de DPE déposés sur la commune (ADEME public) ou null */
  ademeDpeCount: number | null
}

// Cache mémoire process-local 1h, fallback si Next.js cache miss
const cache = new Map<string, { data: LocalStats; until: number }>()

export async function fetchPublicLocalStats(
  inseeCode: string | null,
): Promise<LocalStats> {
  const empty: LocalStats = { dvfMedianEurM2: null, inseePopulation: null, ademeDpeCount: null }
  if (!inseeCode || !/^\d{5}[A-B]?$/.test(inseeCode)) return empty

  const cached = cache.get(inseeCode)
  if (cached && cached.until > Date.now()) return cached.data

  const [dvf, pop, ademe] = await Promise.allSettled([
    fetchDvfMedian(inseeCode),
    fetchInseePopulation(inseeCode),
    fetchAdemeDpeCount(inseeCode),
  ])

  const data: LocalStats = {
    dvfMedianEurM2: dvf.status === 'fulfilled' ? dvf.value : null,
    inseePopulation: pop.status === 'fulfilled' ? pop.value : null,
    ademeDpeCount: ademe.status === 'fulfilled' ? ademe.value : null,
  }
  cache.set(inseeCode, { data, until: Date.now() + 3_600_000 })
  return data
}

interface DvfMutation {
  valeur_fonciere: number | null
  surface_reelle_bati: number | null
  type_local: string | null
}

interface DvfResponse {
  mutations?: DvfMutation[]
  features?: Array<{ properties: DvfMutation }>
}

async function fetchDvfMedian(insee: string): Promise<number | null> {
  const currentYear = new Date().getFullYear()
  // Essai année N-1 puis N-2 (DVF publie avec ~6 mois de retard)
  for (const year of [currentYear - 1, currentYear - 2]) {
    try {
      const r = await fetch(
        `https://app.dvf.etalab.gouv.fr/api/mutations3/${insee}/${year}`,
        { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(8000) },
      )
      if (!r.ok) continue
      const json = (await r.json()) as DvfResponse
      const muts = json.mutations ?? json.features?.map((f) => f.properties) ?? []
      const filtered = muts.filter(
        (m): m is DvfMutation & { valeur_fonciere: number; surface_reelle_bati: number } =>
          m !== null
          && typeof m.valeur_fonciere === 'number'
          && typeof m.surface_reelle_bati === 'number'
          && (m.type_local === 'Maison' || m.type_local === 'Appartement')
          && m.valeur_fonciere > 1000
          && m.surface_reelle_bati > 5,
      )
      if (filtered.length < 3) continue
      const prices = filtered
        .map((m) => m.valeur_fonciere / m.surface_reelle_bati)
        .filter((p) => p > 100 && p < 30_000) // Filtre aberrants
        .sort((a, b) => a - b)
      if (prices.length < 3) continue
      const median = prices[Math.floor(prices.length / 2)] ?? null
      return median === null ? null : Math.round(median)
    } catch {
      continue
    }
  }
  return null
}

interface GeoApiResponse {
  population?: number
}

async function fetchInseePopulation(insee: string): Promise<number | null> {
  try {
    const r = await fetch(
      `https://geo.api.gouv.fr/communes/${insee}?fields=population`,
      { next: { revalidate: 604_800 }, signal: AbortSignal.timeout(5000) },
    )
    if (!r.ok) return null
    const json = (await r.json()) as GeoApiResponse
    return typeof json.population === 'number' ? json.population : null
  } catch {
    return null
  }
}

interface AdemeDataFairResponse {
  total?: number
}

async function fetchAdemeDpeCount(insee: string): Promise<number | null> {
  try {
    const url = `https://data.ademe.fr/data-fair/api/v1/datasets/dpe-v2-logements-existants/lines?qs=code_insee_commune%3A%22${insee}%22&size=0`
    const r = await fetch(url, {
      next: { revalidate: 86_400 },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return null
    const json = (await r.json()) as AdemeDataFairResponse
    return typeof json.total === 'number' ? json.total : null
  } catch {
    return null
  }
}
