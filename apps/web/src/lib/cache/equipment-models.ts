/**
 * KOVAS — Equipment models cache progressif app-level (Lot B48).
 *
 * Technique 5 du doc `AI_ECONOMICS.md` : **−80-90% sur Vision IA à terme**.
 *
 * Principe :
 *   1. Avant chaque appel Vision Claude, on cherche dans la table
 *      `data.equipment_brands_models` si le couple (brand, model) extrait
 *      par OCR (ou estimation préalable) existe déjà.
 *   2. Si match fuzzy >= 85% → on évite l'appel Vision (coût 0€).
 *   3. Sinon → on lance Vision, et on insert le résultat dans la table
 *      (ou on incrémente `occurrence_count`) pour les requêtes futures.
 *
 * Après 6 mois et ~10 000 missions, les 100 modèles top couvrent 90% du
 * marché FR. L'usage Vision drop à ~10% des analyses. Sur 1500 calls/mo
 * Vision (estimation Pro à scale), économie : ~12€ → ~1,20€/mo platform.
 *
 * Ce module est **pure-fn** (normalisation + matching) — l'IO Supabase
 * est délégué au caller via dependency injection. Permet :
 *   - Tests Vitest 100% déterministes
 *   - Réutilisation côté Edge Function Deno (sans dep Node)
 *   - Migration future vers Vercel KV (front-cache supplémentaire)
 */

export interface EquipmentEntry {
  /** Marque (ex: 'Saunier Duval', 'Atlantic') */
  brand: string
  /** Modèle (ex: 'F30 Pro', 'Sun Magic') */
  model: string
  /** Type équipement (ex: 'chaudiere_gaz', 'pac_air_eau') */
  equipment_type: string
  /** Type énergie principale (ex: 'gaz_naturel', 'electricite') */
  energy_type: string | null
  /** Classe énergie (A++, B, etc.) si applicable */
  energy_class: string | null
  /** Puissance kW */
  power_kw: number | null
  /** Année de commercialisation min */
  year_min: number | null
  /** Année de commercialisation max (null = encore commercialisé) */
  year_max: number | null
  /** Specs additionnelles libres (rendement, COP, etc.) */
  specs: Record<string, unknown> | null
}

export interface EquipmentLookupQuery {
  /** Marque devinée par OCR / saisie manuelle. Peut contenir typos. */
  brand: string
  /** Modèle deviné. Peut contenir typos / espaces / casse différente. */
  model: string
  /** Type équipement attendu (filtre dur, pas fuzzy). Optional pour large search. */
  equipment_type?: string
}

export interface EquipmentMatchResult {
  /** L'entrée matchée, ou null si pas de cache hit. */
  entry: EquipmentEntry | null
  /** Score de matching 0-1 (similarité brand×model). 1 = match exact. */
  confidence: number
  /** Raison textuelle (debug + logs). */
  reason: string
  /** Si true, on saute l'appel Vision IA. Si false, fallback Vision. */
  cache_hit: boolean
}

/** Seuil par défaut de cache hit. >= 0.85 = hit, < = miss + fallback Vision. */
export const DEFAULT_EQUIPMENT_CACHE_THRESHOLD = 0.85

/**
 * Normalise une chaîne pour comparaison fuzzy.
 *
 * Stratégie :
 *  - lowercase
 *  - retire les accents (é → e, à → a)
 *  - retire la ponctuation (-, /, ., ',')
 *  - condense les espaces multiples
 *  - trim
 *
 * Exemples :
 *  - "Saunier-Duval F30 Pro" → "saunier duval f30 pro"
 *  - "ATLANTIC Sun'magic" → "atlantic sun magic"
 *  - "  De  Dietrich  " → "de dietrich"
 */
export function normalizeEquipmentKey(raw: string): string {
  if (!raw) return ''
  return (
    raw
      .normalize('NFD')
      // biome-ignore lint/suspicious/noMisleadingCharacterClass: range U+0300-U+036F combining diacritical marks (accents) is the standard NFD-stripping technique.
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[-_./,'"]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * Calcule un score de similarité 0-1 entre deux chaînes normalisées.
 *
 * Utilise une combinaison :
 *  - exact match → 1.0
 *  - one is substring of the other → 0.95 (très probable même modèle)
 *  - sinon, Jaccard sur les tokens mots → variable
 *
 * Pure-fn déterministe.
 */
export function stringSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const na = normalizeEquipmentKey(a)
  const nb = normalizeEquipmentKey(b)
  if (na === nb) return 1
  if (na.includes(nb) || nb.includes(na)) return 0.95

  const tokensA = new Set(na.split(' ').filter(Boolean))
  const tokensB = new Set(nb.split(' ').filter(Boolean))
  if (tokensA.size === 0 || tokensB.size === 0) return 0

  let intersection = 0
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection += 1
  }
  const unionSize = tokensA.size + tokensB.size - intersection
  return unionSize === 0 ? 0 : intersection / unionSize
}

/**
 * Calcule le score combiné brand × model. Pondération :
 *  - brand similarity : 40% (souvent court, plus facile à matcher)
 *  - model similarity : 60% (plus discriminant)
 *
 * Si le brand ne matche PAS du tout (< 0.5), retourne 0 immédiatement
 * (deux modèles homonymes de marques différentes sont des produits
 * différents — anti-collision).
 */
export function scoreEquipmentMatch(
  query: EquipmentLookupQuery,
  candidate: EquipmentEntry,
): number {
  const brandSim = stringSimilarity(query.brand, candidate.brand)
  if (brandSim < 0.5) return 0
  const modelSim = stringSimilarity(query.model, candidate.model)
  return brandSim * 0.4 + modelSim * 0.6
}

/**
 * Trouve la meilleure entrée matchant la query dans un pool de candidats.
 *
 * - Filtre d'abord par `equipment_type` si fourni (filtre dur).
 * - Score chaque candidat avec `scoreEquipmentMatch`.
 * - Retient le score max. Si >= `threshold` → cache hit, sinon miss.
 *
 * Pure-fn — le pool de candidats est passé en paramètre (idéalement déjà
 * pré-filtré par la requête SQL `WHERE brand ILIKE 'saunier%'`).
 */
export function matchEquipmentCache(
  query: EquipmentLookupQuery,
  candidates: ReadonlyArray<EquipmentEntry>,
  threshold: number = DEFAULT_EQUIPMENT_CACHE_THRESHOLD,
): EquipmentMatchResult {
  const filtered = query.equipment_type
    ? candidates.filter((c) => c.equipment_type === query.equipment_type)
    : candidates

  if (filtered.length === 0) {
    return {
      entry: null,
      confidence: 0,
      reason: query.equipment_type
        ? `Pas de candidat pour equipment_type='${query.equipment_type}'`
        : 'Pool de candidats vide',
      cache_hit: false,
    }
  }

  let best: EquipmentEntry | null = null
  let bestScore = 0
  for (const c of filtered) {
    const score = scoreEquipmentMatch(query, c)
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }

  if (best === null || bestScore < threshold) {
    return {
      entry: null,
      confidence: bestScore,
      reason: `Best score ${bestScore.toFixed(2)} < seuil ${threshold.toFixed(2)} → fallback Vision`,
      cache_hit: false,
    }
  }

  return {
    entry: best,
    confidence: bestScore,
    reason: `Match '${best.brand} ${best.model}' avec score ${bestScore.toFixed(2)}`,
    cache_hit: true,
  }
}

/**
 * Coût Vision IA évité par cache hit (basé sur le tarif Anthropic Claude
 * Vision : ~0,0165 USD par appel résolu via Vision Sonnet 4.6, soit
 * ~0,015 EUR au taux de change actuel).
 */
export const VISION_CALL_COST_EUR = 0.015

/**
 * Estime l'économie cumulée sur N analyses, en supposant un taux de cache
 * hit donné. Utilisé par le dashboard `/admin/sante-tech` pour projeter
 * les économies à partir du `cache_hit_rate` mesuré.
 */
export function estimateEquipmentCacheSavings(input: {
  totalAnalyses: number
  cacheHitRate: number // 0-1
}): {
  baseline_cost_eur: number
  cache_cost_eur: number
  saved_eur: number
  saved_pct: number
} {
  const hitRate = Math.max(0, Math.min(1, input.cacheHitRate))
  const baseline = input.totalAnalyses * VISION_CALL_COST_EUR
  // Seuls les cache misses déclenchent un appel Vision facturé.
  const cacheCost = input.totalAnalyses * (1 - hitRate) * VISION_CALL_COST_EUR
  const saved = baseline - cacheCost
  return {
    baseline_cost_eur: Math.round(baseline * 1_000_000) / 1_000_000,
    cache_cost_eur: Math.round(cacheCost * 1_000_000) / 1_000_000,
    saved_eur: Math.round(saved * 1_000_000) / 1_000_000,
    saved_pct: baseline > 0 ? Math.round((saved / baseline) * 1000) / 10 : 0,
  }
}
