/**
 * KOVAS — Module 2 — Moteur statistique de suggestion paramétrique.
 *
 * Logique V1 (cf. CLAUDE.md §7bis — autonomisation IA progressive) :
 *
 *   Au lieu d'un modèle ML lourd, on agrège l'open data ADEME déjà
 *   en cache local (`ademe_dpe_cache`). Pour chaque paramètre demandé,
 *   on calcule la distribution des valeurs observées sur un échantillon
 *   de DPE "similaires" (année construction ± 5, surface ± 20%,
 *   même type bâtiment, même région).
 *
 *   On retourne la modale (valeur majoritaire) + sa probabilité +
 *   les 3 alternatives suivantes. Si l'échantillon est < 50 cas,
 *   on renvoie `null` et l'appelant fallback sur `static-rules`.
 *
 * Cache LRU 1h sur la signature de contexte (limite la charge sur la DB).
 *
 * Phase 2 (M18+) : remplacement par un fine-tune Llama 3.3 70B entraîné
 * sur 100k+ missions KOVAS (cf. `ai-autonomy-strategy.md` §9).
 */

import type {
  ParameterName,
  SuggestionAlternative,
  SuggestionContext,
  SuggestionOutput,
} from './parameter-types'

// ============================================================
// Champs ADEME → paramètre KOVAS.
// ============================================================

const ADEME_FIELD_BY_PARAMETER: Record<ParameterName, string | null> = {
  type_ventilation: 'type_ventilation',
  type_chauffage: 'type_chauffage',
  type_ecs: 'type_ecs',
  type_climatisation: 'type_climatisation',
  // Pas d'équivalent direct dans ademe_dpe_cache pour ces 3 paramètres
  // (à enrichir Phase 2 via parsing raw_payload).
  type_isolation_murs: null,
  type_isolation_toiture: null,
  type_menuiseries: null,
}

// ============================================================
// Cache LRU 1h sur signature contexte.
// ============================================================

interface CacheEntry {
  value: SuggestionOutput
  expiresAt: number
}

const LRU_MAX_ENTRIES = 500
const LRU_TTL_MS = 60 * 60 * 1000 // 1h
const lruCache = new Map<string, CacheEntry>()

export function makeCacheKey(parameterName: ParameterName, ctx: SuggestionContext): string {
  // Signature stable : on round les valeurs continues pour maximiser le hit rate.
  const yearBucket = typeof ctx.yearBuilt === 'number' ? Math.floor(ctx.yearBuilt / 5) * 5 : 'na'
  const surfaceBucket = typeof ctx.surface === 'number' ? Math.floor(ctx.surface / 20) * 20 : 'na'
  const region = ctx.inseeCode ?? ctx.postalCode ?? 'na'
  const bType = ctx.buildingType ?? 'na'
  return `${parameterName}|${yearBucket}|${surfaceBucket}|${region}|${bType}`
}

function getCached(key: string): SuggestionOutput | null {
  const entry = lruCache.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    lruCache.delete(key)
    return null
  }
  // Refresh LRU order : remove + re-set
  lruCache.delete(key)
  lruCache.set(key, entry)
  return entry.value
}

function setCached(key: string, value: SuggestionOutput): void {
  if (lruCache.size >= LRU_MAX_ENTRIES) {
    const oldest = lruCache.keys().next().value
    if (oldest) lruCache.delete(oldest)
  }
  lruCache.set(key, { value, expiresAt: Date.now() + LRU_TTL_MS })
}

// ============================================================
// Interface client Supabase minimaliste (compatible Edge + Web).
// On ne dépend pas du SupabaseClient typé pour rester portable.
// ============================================================

export interface AdemeQueryClient {
  /**
   * Requête le cache ADEME filtré par les critères de similarité contextuelle.
   * Retourne les valeurs observées du champ demandé.
   */
  fetchSimilarValues(params: {
    organizationId: string
    ademeField: string
    yearMin: number | null
    yearMax: number | null
    surfaceMin: number | null
    surfaceMax: number | null
    buildingType: string | null
    inseeCode: string | null
    postalCode: string | null
    limit: number
  }): Promise<Array<string | null>>
}

// ============================================================
// Agrégation statistique.
// ============================================================

interface Distribution {
  total: number
  counts: Map<string, number>
}

function aggregateDistribution(values: Array<string | null>): Distribution {
  const counts = new Map<string, number>()
  let total = 0
  for (const v of values) {
    if (v === null || v.trim() === '') continue
    const normalized = normalizeValue(v)
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
    total += 1
  }
  return { total, counts }
}

function normalizeValue(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[éèê]/g, 'e')
    .replace(/[àâ]/g, 'a')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/[ç]/g, 'c')
}

function topNAlternatives(
  dist: Distribution,
  topValue: string,
  n: number,
): SuggestionAlternative[] {
  if (dist.total === 0) return []
  const sorted = [...dist.counts.entries()]
    .filter(([v]) => v !== topValue)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
  return sorted.map(([value, count]) => ({
    value,
    count,
    probability: count / dist.total,
  }))
}

// ============================================================
// API publique : suggestFromAdemeStats
// ============================================================

const MIN_SAMPLES = 50

export interface StatisticalEngineOptions {
  /** Seuil minimal d'échantillons pour produire une suggestion. */
  minSamples?: number
  /** Cap dur sur le nombre de lignes lues (perf). */
  fetchLimit?: number
}

export async function suggestFromAdemeStats(
  client: AdemeQueryClient,
  parameterName: ParameterName,
  context: SuggestionContext,
  organizationId: string,
  options: StatisticalEngineOptions = {},
): Promise<SuggestionOutput | null> {
  const cacheKey = makeCacheKey(parameterName, context)
  const cached = getCached(cacheKey)
  if (cached) return cached

  const ademeField = ADEME_FIELD_BY_PARAMETER[parameterName]
  if (!ademeField) return null

  const minSamples = options.minSamples ?? MIN_SAMPLES
  const fetchLimit = options.fetchLimit ?? 2000

  const yearBuilt = context.yearBuilt
  const surface = context.surface
  const yearMin = typeof yearBuilt === 'number' ? yearBuilt - 5 : null
  const yearMax = typeof yearBuilt === 'number' ? yearBuilt + 5 : null
  const surfaceMin = typeof surface === 'number' ? Math.floor(surface * 0.8) : null
  const surfaceMax = typeof surface === 'number' ? Math.ceil(surface * 1.2) : null
  const buildingType =
    typeof context.buildingType === 'string' && context.buildingType.length > 0
      ? context.buildingType
      : null
  const inseeCode = typeof context.inseeCode === 'string' ? context.inseeCode : null
  const postalCode = typeof context.postalCode === 'string' ? context.postalCode : null

  const rawValues = await client.fetchSimilarValues({
    organizationId,
    ademeField,
    yearMin,
    yearMax,
    surfaceMin,
    surfaceMax,
    buildingType,
    inseeCode,
    postalCode,
    limit: fetchLimit,
  })

  const distribution = aggregateDistribution(rawValues)
  if (distribution.total < minSamples) return null

  // Modale + probabilité
  let bestValue: string | null = null
  let bestCount = 0
  for (const [value, count] of distribution.counts) {
    if (count > bestCount) {
      bestCount = count
      bestValue = value
    }
  }
  if (!bestValue) return null

  const probability = bestCount / distribution.total
  const alternatives = topNAlternatives(distribution, bestValue, 3)

  const output: SuggestionOutput = {
    parameterName,
    suggestedValue: bestValue,
    confidenceScore: Number(probability.toFixed(3)),
    alternatives,
    justification: `Modale observée sur ${distribution.total} DPE ADEME similaires (année ± 5 ans, surface ± 20%, type identique${inseeCode ? ', commune similaire' : ''}). Valeur la plus fréquente : ${bestValue} (${(probability * 100).toFixed(1)}%).`,
    reglementaryReferences: [
      {
        label: 'ADEME — Open data DPE V2 logements existants',
        url: 'https://data.ademe.fr/datasets/dpe-v2-logements-existants',
      },
    ],
    similarCasesCount: distribution.total,
    source: 'ademe_statistics',
    cacheKey,
    computedAt: new Date().toISOString(),
  }
  setCached(cacheKey, output)
  return output
}

// ============================================================
// Reset cache (utile pour tests).
// ============================================================

export function _resetSuggestionCache(): void {
  lruCache.clear()
}
