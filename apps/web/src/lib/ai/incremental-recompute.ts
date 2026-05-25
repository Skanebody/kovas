/**
 * KOVAS — Cache invalidation intelligente / recompute incrémental (Lot B49).
 *
 * Technique 15 du doc `AI_ECONOMICS.md` : **−20-30% sur les recomputes**.
 *
 * Principe : quand un utilisateur édite une mission (corrige l'année de
 * construction, ajoute une photo, change le type de chauffage...), au lieu
 * de relancer toutes les analyses IA depuis zéro, on détecte les champs
 * changés et on ne recalcule que les analyses qui en dépendent.
 *
 * Exemple concret : utilisateur corrige `year_built` 1985 → 1948 (pré-amiante).
 *   - Sans cette technique : 5 analyses relancées (15€ de coûts IA cumulés)
 *   - Avec cette technique : 3 analyses relancées (9€) — économie 40%
 *
 * Ce module fournit la **carte des dépendances** (FIELD_DEPENDENCIES) + un
 * helper pure-fn `findAffectedAnalyses(changedFields)` qui retourne la
 * liste des analyses à relancer. L'IO de relance reste côté caller.
 */

/**
 * Tous les types d'analyses IA reconnus. Liste exhaustive pour validation
 * type-safe des dépendances.
 */
export type AnalysisType =
  | 'conformity_score' // A1.3.3 — Score conformité multi-dimensionnel
  | 'risk_ademe' // Risque rejet ADEME (cohérence chauffage / surface / classe)
  | 'cadastre_check' // A1.3.2 — Cohérence cadastre vs surface déclarée
  | 'dpe_shopping_check' // A1.3.1 — DPE shopping detection
  | 'dpe_class_prediction' // Prédiction classe DPE attendue
  | 'vision_equipment' // A1.3.6 — Vision IA reconnaissance équipement
  | 'production_anomaly' // A1.3.9 — Anomalie de production DPE
  | 'document_classification' // A1.3.7 — Classification doc client uploadé
  | 'lead_scoring' // A1.3.5 — Score intent lead B2C
  | 'pattern_learning' // A1.3.13 — Pattern learning per diagnostician

/**
 * Carte des dépendances champ → analyses affectées.
 *
 * Chaque champ d'une mission peut déclencher la recomputation d'un sous-
 * ensemble d'analyses. La table doit rester exhaustive : tout nouveau
 * champ ajouté au schéma `missions` doit être listé ici (ou explicitement
 * marqué comme "n'affecte aucune analyse").
 *
 * Granularité : on choisit les analyses qui dépendent VRAIMENT du champ.
 * Un sur-listing entraîne du sur-recompute (coût IA inutile). Un sous-
 * listing entraîne de la stale data. Le test `dependencyCompleteness` veille.
 */
export const FIELD_DEPENDENCIES: Readonly<Record<string, ReadonlyArray<AnalysisType>>> = {
  // Caractéristiques du bien
  year_built: ['conformity_score', 'risk_ademe', 'cadastre_check', 'dpe_class_prediction'],
  surface_carrez: ['conformity_score', 'cadastre_check', 'dpe_class_prediction'],
  surface_habitable: ['conformity_score', 'cadastre_check', 'dpe_class_prediction'],
  heating_type: ['conformity_score', 'dpe_class_prediction', 'risk_ademe'],
  heating_subtype: ['conformity_score', 'dpe_class_prediction'],
  water_heating_type: ['conformity_score', 'dpe_class_prediction'],
  insulation_walls: ['dpe_class_prediction'],
  insulation_roof: ['dpe_class_prediction'],
  windows_type: ['dpe_class_prediction'],
  ventilation_type: ['conformity_score', 'dpe_class_prediction'],

  // Localisation
  address: ['cadastre_check', 'risk_ademe'],
  postal_code: ['cadastre_check', 'dpe_shopping_check'],
  city: ['cadastre_check', 'dpe_shopping_check'],

  // Photos & equipements
  photos: ['vision_equipment', 'conformity_score', 'production_anomaly'],
  equipment_list: ['conformity_score', 'risk_ademe'],

  // Diagnostic metadata
  diagnostic_type: ['conformity_score', 'risk_ademe', 'pattern_learning'],
  estimated_dpe_class: ['conformity_score', 'dpe_shopping_check', 'production_anomaly'],
  dpe_class_final: ['production_anomaly', 'pattern_learning'],

  // Client uploads
  uploaded_documents: ['document_classification', 'conformity_score'],

  // Champs neutres (n'affectent aucune analyse — listés explicitement
  // pour empêcher silently d'oublier de mapper)
  client_name: [],
  client_email: [],
  client_phone: [],
  notes_libres: [],
  diagnostician_signature_url: [],
  created_at: [],
  updated_at: [],
}

/**
 * Pour chaque analyse, son coût IA EUR estimé (snapshot moyen) — utilisé
 * par `estimateRecomputeSavings` pour projeter l'économie. Calibré sur le
 * doc AI_ECONOMICS § Trajectoire utilisateur.
 */
const ANALYSIS_COST_EUR: Readonly<Record<AnalysisType, number>> = {
  conformity_score: 0.005, // Sonnet, prompt court
  risk_ademe: 0.003, // Haiku, règles métier + valid
  cadastre_check: 0.002, // Haiku, lookup + check
  dpe_shopping_check: 0.002, // Haiku, lookup historique
  dpe_class_prediction: 0.008, // Sonnet, prédiction multi-facteurs
  vision_equipment: 0.015, // Sonnet Vision, le plus cher
  production_anomaly: 0.003, // Haiku, anomalie batch
  document_classification: 0.002, // Haiku, classification
  lead_scoring: 0.001, // Pure-fn locale (pas Claude)
  pattern_learning: 0.005, // Sonnet, integration pattern
}

export interface AffectedAnalysesResult {
  /** Set unique des analyses à recompute. */
  analyses: ReadonlyArray<AnalysisType>
  /** Coût IA EUR estimé du recompute incrémental. */
  estimated_cost_eur: number
  /** Champs qu'on n'a pas réussi à mapper (warn — schéma à enrichir). */
  unmapped_fields: ReadonlyArray<string>
}

/**
 * Trouve les analyses affectées par un set de champs modifiés.
 *
 * - Champs non listés dans FIELD_DEPENDENCIES → reportés en `unmapped_fields`
 *   (le caller peut décider de tout recompute par sécurité, ou logger un warn).
 * - Si aucun champ ne change → renvoie un set vide (rien à recompute).
 *
 * Pure-fn déterministe.
 */
export function findAffectedAnalyses(changedFields: ReadonlyArray<string>): AffectedAnalysesResult {
  const affected = new Set<AnalysisType>()
  const unmapped: string[] = []

  for (const field of changedFields) {
    const deps = FIELD_DEPENDENCIES[field]
    if (deps === undefined) {
      unmapped.push(field)
      continue
    }
    for (const analysis of deps) {
      affected.add(analysis)
    }
  }

  const analyses: AnalysisType[] = Array.from(affected).sort()
  const estimated_cost_eur =
    Math.round(analyses.reduce((sum, a) => sum + ANALYSIS_COST_EUR[a], 0) * 1_000_000) / 1_000_000

  return {
    analyses,
    estimated_cost_eur,
    unmapped_fields: unmapped,
  }
}

/**
 * Coût IA EUR d'un recompute complet (toutes les analyses). Sert de baseline
 * pour `estimateRecomputeSavings`.
 */
export function fullRecomputeCostEur(): number {
  return (
    Math.round(Object.values(ANALYSIS_COST_EUR).reduce((sum, c) => sum + c, 0) * 1_000_000) /
    1_000_000
  )
}

/**
 * Estime l'économie réalisée par recompute incrémental vs recompute complet.
 *
 * Utilisé par le dashboard `/admin/sante-tech` pour projeter les économies
 * à partir du nombre de champs modifiés moyen par édition utilisateur.
 */
export function estimateRecomputeSavings(input: {
  totalEdits: number
  changedFieldsPerEdit: number // ex 2 = en moyenne, l'user change 2 champs par édition
}): {
  baseline_cost_eur: number
  incremental_cost_eur: number
  saved_eur: number
  saved_pct: number
} {
  const baseline = input.totalEdits * fullRecomputeCostEur()

  // Approximation : pour n champs changés, on touche en moyenne n × 2 analyses
  // (chaque champ a en moyenne ~2 dépendances dans FIELD_DEPENDENCIES, sauf
  // les champs neutres). Plafonné par le coût total complet.
  const avgAnalysesPerEdit = Math.min(
    Object.keys(ANALYSIS_COST_EUR).length,
    Math.max(0, input.changedFieldsPerEdit) * 2,
  )
  const avgCostPerEdit =
    (fullRecomputeCostEur() / Object.keys(ANALYSIS_COST_EUR).length) * avgAnalysesPerEdit
  const incremental = input.totalEdits * avgCostPerEdit

  const saved = Math.max(0, baseline - incremental)
  return {
    baseline_cost_eur: Math.round(baseline * 1_000_000) / 1_000_000,
    incremental_cost_eur: Math.round(incremental * 1_000_000) / 1_000_000,
    saved_eur: Math.round(saved * 1_000_000) / 1_000_000,
    saved_pct: baseline > 0 ? Math.round((saved / baseline) * 1000) / 10 : 0,
  }
}
