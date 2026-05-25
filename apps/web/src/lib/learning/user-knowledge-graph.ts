/**
 * KOVAS — Lot B59 : Pattern learning graph sémantique (au-delà de A1.3.13).
 *
 * Construit un knowledge graph par utilisateur (diagnostiqueur), JSONB-friendly,
 * à partir de ses missions passées. Permet ensuite de prédire ~70% des champs
 * d'une nouvelle mission (zone géo, équipements, type bien, ratios DPE) après
 * 30-50 missions historiques.
 *
 * Le but business est de réduire les appels Claude full-analysis : si le delta
 * entre la prédiction et la réalité est faible, on peut réutiliser un cache
 * structuré ou ne demander qu'une analyse incrémentale (cf. doc
 * `docs/refonte-2026-05/AI_ECONOMICS.md` Technique 10).
 *
 * **Pure fonctions, zéro IO** — l'orchestrateur (Edge Function ou route handler)
 * qui consomme ces helpers + persiste le graph dans Postgres est un **lot
 * futur dédié** (non couvert ici).
 *
 * **Migration SQL** : une migration future créera la table JSONB
 * `data.user_mission_patterns(diagnostician_id PK, graph JSONB, updated_at)`
 * (cf. AI_ECONOMICS.md §Technique 10). Hors-scope de ce lot.
 *
 * Coexiste avec `lib/algos/diagnostician-pattern-learning.ts` (A1.3.13) qui
 * gère le scoring de conformité — ce module-ci traite la **prédiction
 * sémantique des champs** (différent objectif, différent stockage).
 *
 * Authority : `docs/refonte-2026-05/AI_ECONOMICS.md` Technique 10.
 */

/**
 * Représentation minimale d'une mission utilisée pour bâtir/prédire le graph.
 * Délibérément "lite" : on n'a pas besoin de l'entièreté du modèle mission
 * pour faire de l'agrégation statistique. Champs optionnels = on les ignore
 * lors de l'agrégation s'ils sont absents.
 */
export interface MissionLite {
  readonly id: string
  readonly created_at: string
  readonly postal_code?: string | null
  readonly property_type?: PropertyType | null
  readonly year_built?: number | null
  readonly surface_m2?: number | null
  readonly dpe_class?: DpeClass | null
  readonly equipment_brands?: ReadonlyArray<string> | null
  readonly anomaly_patterns?: ReadonlyArray<string> | null
}

export type PropertyType = 'maison' | 'appartement' | 'autre'
export type DpeClass = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'

const ALL_DPE_CLASSES: ReadonlyArray<DpeClass> = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
const ALL_PROPERTY_TYPES: ReadonlyArray<PropertyType> = ['maison', 'appartement', 'autre']

/**
 * Le knowledge graph stocké en JSONB par utilisateur (sérialisable à
 * `JSON.stringify(graph)` sans perte). Tous les compteurs sont des integers
 * positifs, toutes les dates sont ISO 8601 UTC.
 */
export interface UserKnowledgeGraph {
  /** Top 10 marques d'équipement les plus fréquemment rencontrées */
  readonly frequent_equipment_brands: ReadonlyArray<EquipmentBrandEntry>
  /** Top 20 codes postaux les plus fréquents (zone géo de travail) */
  readonly frequent_postal_codes: ReadonlyArray<PostalCodeEntry>
  /** Répartition par type de bien (maison/appartement/autre) */
  readonly frequent_property_types: ReadonlyArray<PropertyTypeEntry>
  /** Distribution des classes DPE attribuées historiquement */
  readonly dpe_class_distribution: Record<DpeClass, number>
  /** Moyenne année construction des biens audités (null si aucune donnée) */
  readonly avg_year_built: number | null
  /** Moyenne surface m² des biens audités (null si aucune donnée) */
  readonly avg_surface_m2: number | null
  /** Patterns d'anomalies récurrents (ex: "DPE F + chaudière gaz neuve") */
  readonly recurring_anomaly_patterns: ReadonlyArray<AnomalyPatternEntry>
  /** Nombre de missions agrégées pour calculer ce graph */
  readonly sample_size: number
  /** Timestamp ISO 8601 UTC de la dernière mise à jour */
  readonly last_updated_at: string
}

export interface EquipmentBrandEntry {
  readonly brand: string
  readonly count: number
  /** Dernière date où cette marque a été observée (ISO 8601) */
  readonly last_seen: string
}

export interface PostalCodeEntry {
  readonly postal_code: string
  readonly count: number
}

export interface PropertyTypeEntry {
  readonly type: PropertyType
  readonly count: number
}

export interface AnomalyPatternEntry {
  readonly pattern: string
  readonly count: number
}

/**
 * Limites des top-N stockées dans le graph. Choisi pour rester < 4 Kio JSONB
 * compressé par utilisateur (cible Supabase Postgres).
 */
const TOP_EQUIPMENT_BRANDS = 10
const TOP_POSTAL_CODES = 20

/**
 * Seuils business pour les stratégies (cf. AI_ECONOMICS.md Technique 10) :
 * - delta < 10% → on peut réutiliser une analyse passée ("reuse_full")
 * - delta < 30% → analyse incrémentale (Claude reçoit seulement le delta)
 * - delta ≥ 30% → full analysis Claude (mission "atypique" pour ce diag)
 */
const DELTA_THRESHOLD_REUSE = 0.1
const DELTA_THRESHOLD_INCREMENTAL = 0.3

/**
 * Coûts indicatifs en euros (cible AI_ECONOMICS.md). Volontairement gardés
 * en constantes ici pour rester pure-fn et testables ; en production
 * l'orchestrateur peut surcharger via DI.
 */
const COST_REUSE_EUR = 0.001
const COST_INCREMENTAL_EUR = 0.012
const COST_FULL_EUR = 0.075

// ---------------------------------------------------------------------------
// buildKnowledgeGraph
// ---------------------------------------------------------------------------

/** Cas vide : retour stable avec sample_size=0 (pas d'agrégation). */
function emptyGraph(now: string): UserKnowledgeGraph {
  return {
    frequent_equipment_brands: [],
    frequent_postal_codes: [],
    frequent_property_types: [],
    dpe_class_distribution: emptyDpeDistribution(),
    avg_year_built: null,
    avg_surface_m2: null,
    recurring_anomaly_patterns: [],
    sample_size: 0,
    last_updated_at: now,
  }
}

function emptyDpeDistribution(): Record<DpeClass, number> {
  const out = {} as Record<DpeClass, number>
  for (const c of ALL_DPE_CLASSES) {
    out[c] = 0
  }
  return out
}

/**
 * Agrège un historique de missions en un knowledge graph JSONB-friendly.
 * Pure-fn déterministe. `now` injectable pour faciliter les tests.
 */
export function buildKnowledgeGraph(
  missions: ReadonlyArray<MissionLite>,
  now: string = new Date().toISOString(),
): UserKnowledgeGraph {
  if (missions.length === 0) {
    return emptyGraph(now)
  }

  // 1. Agrégation marques équipement (count + last_seen)
  const brandMap = new Map<string, { count: number; last_seen: string }>()
  for (const m of missions) {
    if (!m.equipment_brands) continue
    for (const rawBrand of m.equipment_brands) {
      const brand = rawBrand.trim()
      if (brand.length === 0) continue
      const existing = brandMap.get(brand)
      if (existing) {
        existing.count += 1
        if (m.created_at > existing.last_seen) {
          existing.last_seen = m.created_at
        }
      } else {
        brandMap.set(brand, { count: 1, last_seen: m.created_at })
      }
    }
  }
  const frequent_equipment_brands: EquipmentBrandEntry[] = [...brandMap.entries()]
    .map(([brand, v]) => ({ brand, count: v.count, last_seen: v.last_seen }))
    .sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand))
    .slice(0, TOP_EQUIPMENT_BRANDS)

  // 2. Codes postaux
  const postalMap = new Map<string, number>()
  for (const m of missions) {
    if (!m.postal_code) continue
    const pc = m.postal_code.trim()
    if (pc.length === 0) continue
    postalMap.set(pc, (postalMap.get(pc) ?? 0) + 1)
  }
  const frequent_postal_codes: PostalCodeEntry[] = [...postalMap.entries()]
    .map(([postal_code, count]) => ({ postal_code, count }))
    .sort((a, b) => b.count - a.count || a.postal_code.localeCompare(b.postal_code))
    .slice(0, TOP_POSTAL_CODES)

  // 3. Property types (toujours 0-3 entrées, on ne tronque pas)
  const typeMap = new Map<PropertyType, number>()
  for (const m of missions) {
    if (!m.property_type) continue
    typeMap.set(m.property_type, (typeMap.get(m.property_type) ?? 0) + 1)
  }
  const frequent_property_types: PropertyTypeEntry[] = ALL_PROPERTY_TYPES.filter((t) =>
    typeMap.has(t),
  )
    .map((type) => ({ type, count: typeMap.get(type) ?? 0 }))
    .sort((a, b) => b.count - a.count)

  // 4. DPE distribution
  const dpe_class_distribution = emptyDpeDistribution()
  for (const m of missions) {
    if (!m.dpe_class) continue
    dpe_class_distribution[m.dpe_class] += 1
  }

  // 5. Moyennes (ignore null/undefined)
  const avg_year_built = average(missions.map((m) => m.year_built ?? null))
  const avg_surface_m2 = average(missions.map((m) => m.surface_m2 ?? null))

  // 6. Patterns d'anomalies (pas de top-N strict, mais on filtre count >= 2
  //    pour éviter le bruit single-shot et on plafonne à 20 entrées)
  const anomalyMap = new Map<string, number>()
  for (const m of missions) {
    if (!m.anomaly_patterns) continue
    for (const raw of m.anomaly_patterns) {
      const pattern = raw.trim()
      if (pattern.length === 0) continue
      anomalyMap.set(pattern, (anomalyMap.get(pattern) ?? 0) + 1)
    }
  }
  const recurring_anomaly_patterns: AnomalyPatternEntry[] = [...anomalyMap.entries()]
    .filter(([, count]) => count >= 2)
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count || a.pattern.localeCompare(b.pattern))
    .slice(0, 20)

  return {
    frequent_equipment_brands,
    frequent_postal_codes,
    frequent_property_types,
    dpe_class_distribution,
    avg_year_built,
    avg_surface_m2,
    recurring_anomaly_patterns,
    sample_size: missions.length,
    last_updated_at: now,
  }
}

function average(values: ReadonlyArray<number | null>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  if (nums.length === 0) return null
  const sum = nums.reduce((a, b) => a + b, 0)
  return Math.round((sum / nums.length) * 100) / 100
}

// ---------------------------------------------------------------------------
// predictFromGraph
// ---------------------------------------------------------------------------

/** Champ prédit avec sa confidence 0-1 (vide = aucune prédiction possible). */
export interface PredictedField<T> {
  readonly value: T
  readonly confidence: number
}

export interface MissionPredictions {
  readonly postal_code: PredictedField<string> | null
  readonly property_type: PredictedField<PropertyType> | null
  readonly dpe_class: PredictedField<DpeClass> | null
  readonly year_built: PredictedField<number> | null
  readonly surface_m2: PredictedField<number> | null
  readonly likely_equipment_brands: ReadonlyArray<PredictedField<string>>
  /** Confidence globale (moyenne des champs prédits, 0 si rien prédit) */
  readonly overall_confidence: number
  /** True si le graph n'a pas assez de signal pour prédire (cold start) */
  readonly cold_start: boolean
}

/**
 * Volume minimum de missions pour que les prédictions soient considérées
 * comme exploitables. En-dessous, on retourne `cold_start: true` et les
 * predictions sont des fallbacks low-confidence (l'orchestrateur peut
 * choisir de les ignorer entièrement et router en full_analysis).
 */
const COLD_START_THRESHOLD = 10

/**
 * Prédit les champs probables d'une nouvelle mission à partir du graph.
 * `missionInput` (Partial) sert d'indice : si le diag a déjà saisi le code
 * postal, on l'utilise pour conditionner les autres prédictions (zone-aware).
 *
 * Pure-fn. Note : la conditionnalité zone-aware avancée (P(type | postal_code))
 * est un raffinement futur — pour V1 on retourne les marginal distributions.
 */
export function predictFromGraph(
  graph: UserKnowledgeGraph,
  missionInput: Partial<MissionLite> = {},
): MissionPredictions {
  const cold_start = graph.sample_size < COLD_START_THRESHOLD
  const sample = Math.max(graph.sample_size, 1)

  const postal = topOrNull(
    graph.frequent_postal_codes,
    sample,
    (e) => e.postal_code,
    (e) => e.count,
  )
  const ptype = topOrNull(
    graph.frequent_property_types,
    sample,
    (e) => e.type,
    (e) => e.count,
  )

  // DPE : mode de la distribution
  let dpeMax: DpeClass | null = null
  let dpeMaxCount = 0
  let dpeTotal = 0
  for (const c of ALL_DPE_CLASSES) {
    const n = graph.dpe_class_distribution[c]
    dpeTotal += n
    if (n > dpeMaxCount) {
      dpeMaxCount = n
      dpeMax = c
    }
  }
  const dpe_class: PredictedField<DpeClass> | null =
    dpeMax !== null && dpeTotal > 0
      ? { value: dpeMax, confidence: round2(dpeMaxCount / dpeTotal) }
      : null

  // Year built / surface : moyennes brutes, confidence dégradée si cold start
  const baseAvgConf = cold_start ? 0.2 : Math.min(0.85, 0.4 + graph.sample_size / 200)
  const year_built: PredictedField<number> | null =
    graph.avg_year_built !== null
      ? { value: Math.round(graph.avg_year_built), confidence: round2(baseAvgConf) }
      : null
  const surface_m2: PredictedField<number> | null =
    graph.avg_surface_m2 !== null
      ? { value: round2(graph.avg_surface_m2), confidence: round2(baseAvgConf) }
      : null

  // Top 3 marques équipement avec frequency normalisée
  const likely_equipment_brands: PredictedField<string>[] = graph.frequent_equipment_brands
    .slice(0, 3)
    .map((e) => ({ value: e.brand, confidence: round2(Math.min(1, e.count / sample)) }))

  // Confidence globale = moyenne des champs prédits
  const components: number[] = []
  if (postal) components.push(postal.confidence)
  if (ptype) components.push(ptype.confidence)
  if (dpe_class) components.push(dpe_class.confidence)
  if (year_built) components.push(year_built.confidence)
  if (surface_m2) components.push(surface_m2.confidence)
  for (const b of likely_equipment_brands) components.push(b.confidence)

  const overall_confidence =
    components.length > 0 ? round2(components.reduce((a, b) => a + b, 0) / components.length) : 0

  // Hint : si l'input contient déjà un postal_code, on le retourne tel quel
  // avec confidence 1 (signal certain de l'utilisateur)
  const final_postal: PredictedField<string> | null = missionInput.postal_code
    ? { value: missionInput.postal_code, confidence: 1 }
    : postal

  return {
    postal_code: final_postal,
    property_type: ptype,
    dpe_class,
    year_built,
    surface_m2,
    likely_equipment_brands,
    overall_confidence,
    cold_start,
  }
}

function topOrNull<T, V>(
  entries: ReadonlyArray<T>,
  total: number,
  getValue: (e: T) => V,
  getCount: (e: T) => number,
): PredictedField<V> | null {
  if (entries.length === 0) return null
  const top = entries[0]
  if (!top) return null
  return {
    value: getValue(top),
    confidence: round2(Math.min(1, getCount(top) / total)),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ---------------------------------------------------------------------------
// computeDelta
// ---------------------------------------------------------------------------

export interface DeltaResult {
  /** Ratio 0-1 : 0 = prédiction parfaite, 1 = tout faux */
  readonly changeRatio: number
  /** Noms des champs où la prédiction diverge de la réalité */
  readonly deltaFields: ReadonlyArray<string>
}

/**
 * Compare les prédictions vs la mission réelle. Le ratio = nombre de
 * champs divergents / nombre de champs comparés. Un champ absent côté
 * prédiction n'est pas compté (pas pénalisant).
 *
 * Tolérances :
 * - year_built : ±5 ans considéré égal
 * - surface_m2 : ±10% considéré égal
 * - dpe_class : ±1 classe considéré égal (D vs E = no delta, D vs F = delta)
 */
export function computeDelta(predictions: MissionPredictions, actual: MissionLite): DeltaResult {
  const fields: Array<{ name: string; diverges: boolean | null }> = [
    {
      name: 'postal_code',
      diverges: compareNullable(
        predictions.postal_code?.value,
        actual.postal_code,
        (a, b) => a !== b,
      ),
    },
    {
      name: 'property_type',
      diverges: compareNullable(
        predictions.property_type?.value,
        actual.property_type,
        (a, b) => a !== b,
      ),
    },
    {
      name: 'dpe_class',
      diverges: compareNullable(predictions.dpe_class?.value, actual.dpe_class, (a, b) =>
        dpeClassDelta(a, b),
      ),
    },
    {
      name: 'year_built',
      diverges: compareNullable(
        predictions.year_built?.value,
        actual.year_built,
        (a, b) => Math.abs(a - b) > 5,
      ),
    },
    {
      name: 'surface_m2',
      diverges: compareNullable(
        predictions.surface_m2?.value,
        actual.surface_m2,
        (a, b) => Math.abs(a - b) / Math.max(a, b, 1) > 0.1,
      ),
    },
  ]

  const compared = fields.filter((f) => f.diverges !== null)
  if (compared.length === 0) {
    return { changeRatio: 1, deltaFields: ['no_predictions_available'] }
  }

  const diverging = compared.filter((f) => f.diverges === true)
  return {
    changeRatio: round2(diverging.length / compared.length),
    deltaFields: diverging.map((f) => f.name),
  }
}

/**
 * Retourne true si les deux classes diffèrent de plus de 1 cran (D vs E = ok,
 * D vs F = delta). Tolérance qui colle avec la pratique métier diagnostic.
 */
function dpeClassDelta(a: DpeClass, b: DpeClass): boolean {
  const ai = ALL_DPE_CLASSES.indexOf(a)
  const bi = ALL_DPE_CLASSES.indexOf(b)
  return Math.abs(ai - bi) > 1
}

/** Returns null si l'un des deux est manquant (champ non comparable). */
function compareNullable<T>(
  predicted: T | null | undefined,
  actual: T | null | undefined,
  diverges: (a: T, b: T) => boolean,
): boolean | null {
  if (predicted === null || predicted === undefined) return null
  if (actual === null || actual === undefined) return null
  return diverges(predicted, actual)
}

// ---------------------------------------------------------------------------
// routeAnalysisStrategy
// ---------------------------------------------------------------------------

export type AnalysisStrategy = 'reuse_full' | 'incremental' | 'full_analysis'

export interface StrategyDecision {
  readonly strategy: AnalysisStrategy
  readonly estimated_cost_eur: number
}

/**
 * Décide la stratégie d'analyse pour une nouvelle mission, à partir du
 * delta calculé contre les prédictions du graph utilisateur.
 *
 * Seuils (cf. AI_ECONOMICS.md Technique 10) :
 * - delta < 10%  → reuse_full     (cache structuré, quasi-gratuit)
 * - delta < 30%  → incremental    (Claude reçoit le delta uniquement)
 * - delta ≥ 30%  → full_analysis  (mission atypique → analyse complète)
 *
 * Note : si `deltaFields` contient `no_predictions_available`, on force
 * full_analysis (cold start, pas de prédiction exploitable).
 */
export function routeAnalysisStrategy(delta: DeltaResult): StrategyDecision {
  if (delta.deltaFields.includes('no_predictions_available')) {
    return { strategy: 'full_analysis', estimated_cost_eur: COST_FULL_EUR }
  }

  if (delta.changeRatio < DELTA_THRESHOLD_REUSE) {
    return { strategy: 'reuse_full', estimated_cost_eur: COST_REUSE_EUR }
  }
  if (delta.changeRatio < DELTA_THRESHOLD_INCREMENTAL) {
    return { strategy: 'incremental', estimated_cost_eur: COST_INCREMENTAL_EUR }
  }
  return { strategy: 'full_analysis', estimated_cost_eur: COST_FULL_EUR }
}
