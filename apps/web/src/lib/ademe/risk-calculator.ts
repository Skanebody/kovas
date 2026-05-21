/**
 * KOVAS — Module Cockpit ADEME — Risk calculator (pré-validation DPE).
 *
 * Orchestrateur appelé depuis l'API route `ademe-prevalidate` ou l'Edge
 * Function équivalente. Prend en entrée les 10 champs métier saisis par
 * le diagnostiqueur et produit un `RiskAssessment` complet :
 *
 *   - verdict global : green | yellow | red
 *   - score 0-100 (pondéré : volume 30% · distance 20% · coherence 30% · stats 20%)
 *   - warnings détaillées (par axe)
 *   - sous-scores explicables
 *
 * Quatre axes :
 *   1. Volume — basé sur dernier snapshot (dpe_count_12m, _today)
 *   2. Distance — Haversine avec dernier DPE publié (cache local)
 *   3. Coherence — itère règles actives en DB (`ademe_coherence_rules`)
 *   4. Statistical — compare ratio F/G saisi vs national (médiane 27%)
 *   5. (bonus) History — compare avec moyenne historique de l'utilisateur
 *
 * Pas de dépendance ADEME en live : on lit uniquement notre cache local
 * (`ademe_dpe_cache` + `ademe_kpi_snapshots`). Daily sync fait le ravitaillement.
 */

import type { AdemeDpe } from './ademe-api'
import { evaluateRule } from './rule-evaluator'
import type { CoherenceRule } from './rule-evaluator'
import { haversineDistanceKm } from './haversine'

// ============================================================
// Types publics
// ============================================================

/**
 * 10 champs métier minimaux pour pré-validation d'un DPE.
 * Mirror exact spec utilisateur.
 */
export interface PrevalidationInput {
  /** Type de bâtiment (`maison` | `appartement` | `immeuble`). */
  type_batiment: 'maison' | 'appartement' | 'immeuble'
  /** Année de construction (ex: 1972). */
  annee_construction: number
  /** Surface habitable (m²). */
  surface_habitable_m2: number
  /** Type énergie principale chauffage (ex: `electricite`, `gaz`, `fioul`, `pac_air_air`, `pac_air_eau`). */
  type_energie_chauffage: string
  /** Type climatisation (ex: `aucune`, `pac_air_air`, `split_mobile`). */
  type_climatisation: string
  /** Étiquette DPE proposée (A-G). */
  etiquette_dpe: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  /** Étiquette GES proposée (A-G). */
  etiquette_ges: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  /** Consommation énergie primaire 5 usages (kWh/m²/an). */
  conso_5_usages_par_m2_ep: number
  /** Latitude du bien (optionnelle si pas encore géocodé). */
  latitude?: number
  /** Longitude du bien (optionnelle si pas encore géocodé). */
  longitude?: number
}

export type RiskVerdict = 'green' | 'yellow' | 'red'

export interface RiskWarning {
  axis: 'volume' | 'distance' | 'coherence' | 'statistical' | 'history'
  severity: 'info' | 'warning' | 'error' | 'blocking'
  code: string
  message: string
  /** Suggestion corrective (optionnelle). */
  suggested_fix?: string
  /** Détail technique pour debug / audit. */
  context?: Record<string, unknown>
}

export interface RiskAssessment {
  verdict: RiskVerdict
  global_score: number // 0-100, plus haut = plus risqué
  axis_scores: {
    volume: number
    distance: number
    coherence: number
    statistical: number
    history: number
  }
  warnings: RiskWarning[]
  /** Réponses brutes par axe pour audit ultérieur. */
  axis_details: {
    volume: VolumeCheckResult
    distance: DistanceCheckResult
    coherence: CoherenceCheckResult
    statistical: StatisticalCheckResult
    history: HistoryCheckResult
  }
  computed_at: string // ISO timestamp
}

// ============================================================
// Configuration seuils
// ============================================================

// Volume — TODO valider auprès du conseiller diag (cf. snapshot-calculator).
// Pas de source officielle ADEME publique sur les seuils déclencheurs de contrôle.
// Hypothèses observation Liciel + presse spé.
const VOLUME_THRESHOLDS = {
  critical_yearly: 950,
  warning_yearly: 800,
  warning_daily: 6,
} as const

// Distance — TODO valider. Hypothèse : un diagnostiqueur opérant dans un rayon
// > 40 km de son dernier DPE est anormal (cas pratique : il opère sur un secteur
// géographique limité, transporter le matériel à > 40 km serait inefficient).
const DISTANCE_THRESHOLDS = {
  critical_km: 40,
  warning_km: 25,
} as const

// Statistical — ratio F+G national (open data ADEME 2023, ~27% des DPE résidentiels).
const NATIONAL_FG_RATIO = 0.27
const STATISTICAL_TOLERANCE = 0.15

// Pondérations score global (somme = 1).
const WEIGHTS = {
  volume: 0.3,
  distance: 0.2,
  coherence: 0.3,
  statistical: 0.2,
  history: 0.0, // bonus, ne pondère pas le score global V1 (rebaseline V2)
} as const

// ============================================================
// Types per-axis
// ============================================================

export interface VolumeCheckResult {
  count_12m: number
  count_today: number
  level: 'green' | 'yellow' | 'red'
  warnings: RiskWarning[]
}

export interface DistanceCheckResult {
  km_from_last: number | null
  level: 'green' | 'yellow' | 'red'
  warnings: RiskWarning[]
}

export interface CoherenceCheckResult {
  rules_checked: number
  rules_violated: number
  warnings: RiskWarning[]
}

export interface StatisticalCheckResult {
  org_fg_ratio: number | null
  delta_vs_national: number | null
  warnings: RiskWarning[]
}

export interface HistoryCheckResult {
  /** Ratio F/G historique de l'utilisateur sur les 12 derniers mois. */
  user_fg_ratio: number | null
  /** Surface moyenne historique. */
  user_avg_surface: number | null
  warnings: RiskWarning[]
}

// ============================================================
// Loaders abstraits — découpler la logique pure du runtime DB
// ============================================================

/**
 * Adaptateur DB que l'orchestrateur appelle. Implémenté côté Edge Function
 * (Deno + supabase-js) ou côté Node API route. Permet de tester en pur TS
 * en stubant `loadRiskContext`.
 */
export interface RiskContextLoader {
  /** Dernier snapshot KPI de l'organisation (ou null si jamais sync). */
  loadLatestSnapshot(orgId: string, userId: string | null): Promise<LatestSnapshot | null>
  /** Dernier DPE publié dans le cache local (pour calcul distance). */
  loadLastDpe(orgId: string): Promise<AdemeDpe | null>
  /** Règles de cohérence actives. */
  loadCoherenceRules(): Promise<CoherenceRule[]>
  /** Stats historiques agrégées de l'utilisateur (12 mois glissants). */
  loadUserHistory(orgId: string, userId: string | null): Promise<UserHistoryAggregate | null>
}

export interface LatestSnapshot {
  snapshot_date: string
  dpe_count_12m: number
  dpe_count_today: number
  ratio_fg: number
}

export interface UserHistoryAggregate {
  total_dpe: number
  fg_count: number
  avg_surface_m2: number | null
}

// ============================================================
// Orchestrateur principal
// ============================================================

export async function calculateAdemeRisk(
  orgId: string,
  userId: string | null,
  data: PrevalidationInput,
  loader: RiskContextLoader,
): Promise<RiskAssessment> {
  const [snapshot, lastDpe, rules, history] = await Promise.all([
    loader.loadLatestSnapshot(orgId, userId),
    loader.loadLastDpe(orgId),
    loader.loadCoherenceRules(),
    loader.loadUserHistory(orgId, userId),
  ])

  const volume = checkVolumeRisk(snapshot)
  const distance = checkDistanceRisk(lastDpe, data)
  const coherence = checkCoherenceRules(data, rules)
  const statistical = checkStatisticalRisk(snapshot, data)
  const history_check = checkConsistencyWithHistory(history, data)

  // Score par axe — chaque sous-axe rend 0-100.
  const volumeScore = scoreFromLevel(volume.level)
  const distanceScore = scoreFromLevel(distance.level)
  const coherenceScore = scoreCoherenceAxis(coherence)
  const statisticalScore = scoreStatisticalAxis(statistical)
  const historyScore = history_check.warnings.length > 0 ? 30 : 0

  const globalScore = Math.round(
    volumeScore * WEIGHTS.volume +
      distanceScore * WEIGHTS.distance +
      coherenceScore * WEIGHTS.coherence +
      statisticalScore * WEIGHTS.statistical +
      historyScore * WEIGHTS.history,
  )

  const verdict: RiskVerdict = globalScore >= 70 ? 'red' : globalScore >= 40 ? 'yellow' : 'green'

  const warnings: RiskWarning[] = [
    ...volume.warnings,
    ...distance.warnings,
    ...coherence.warnings,
    ...statistical.warnings,
    ...history_check.warnings,
  ]

  return {
    verdict,
    global_score: globalScore,
    axis_scores: {
      volume: volumeScore,
      distance: distanceScore,
      coherence: coherenceScore,
      statistical: statisticalScore,
      history: historyScore,
    },
    warnings,
    axis_details: {
      volume,
      distance,
      coherence,
      statistical,
      history: history_check,
    },
    computed_at: new Date().toISOString(),
  }
}

// ============================================================
// Check : Volume (snapshot-based)
// ============================================================

export function checkVolumeRisk(snapshot: LatestSnapshot | null): VolumeCheckResult {
  if (!snapshot) {
    return { count_12m: 0, count_today: 0, level: 'green', warnings: [] }
  }
  const warnings: RiskWarning[] = []
  let level: 'green' | 'yellow' | 'red' = 'green'

  if (snapshot.dpe_count_12m >= VOLUME_THRESHOLDS.critical_yearly) {
    level = 'red'
    warnings.push({
      axis: 'volume',
      severity: 'error',
      code: 'VOLUME_YEARLY_CRITICAL',
      message: `${snapshot.dpe_count_12m} DPE publiés sur 12 mois — seuil critique ADEME atteint (${VOLUME_THRESHOLDS.critical_yearly}). Risque de contrôle.`,
      suggested_fix: 'Espacer les publications ou justifier la productivité (cabinet, multi-techniciens).',
      context: { count_12m: snapshot.dpe_count_12m, threshold: VOLUME_THRESHOLDS.critical_yearly },
    })
  } else if (snapshot.dpe_count_12m >= VOLUME_THRESHOLDS.warning_yearly) {
    level = 'yellow'
    warnings.push({
      axis: 'volume',
      severity: 'warning',
      code: 'VOLUME_YEARLY_WARNING',
      message: `${snapshot.dpe_count_12m} DPE sur 12 mois — vous approchez le seuil de surveillance ADEME.`,
      context: { count_12m: snapshot.dpe_count_12m, threshold: VOLUME_THRESHOLDS.warning_yearly },
    })
  }

  if (snapshot.dpe_count_today >= VOLUME_THRESHOLDS.warning_daily) {
    if (level === 'green') level = 'yellow'
    warnings.push({
      axis: 'volume',
      severity: 'warning',
      code: 'VOLUME_DAILY_WARNING',
      message: `${snapshot.dpe_count_today} DPE déjà publiés aujourd'hui — cadence anormale.`,
      context: { count_today: snapshot.dpe_count_today, threshold: VOLUME_THRESHOLDS.warning_daily },
    })
  }

  return {
    count_12m: snapshot.dpe_count_12m,
    count_today: snapshot.dpe_count_today,
    level,
    warnings,
  }
}

// ============================================================
// Check : Distance (Haversine avec dernier DPE)
// ============================================================

export function checkDistanceRisk(
  lastDpe: AdemeDpe | null,
  data: PrevalidationInput,
): DistanceCheckResult {
  if (
    !lastDpe ||
    typeof data.latitude !== 'number' ||
    typeof data.longitude !== 'number' ||
    typeof lastDpe.Latitude !== 'number' ||
    typeof lastDpe.Longitude !== 'number'
  ) {
    return { km_from_last: null, level: 'green', warnings: [] }
  }

  const km = haversineDistanceKm(
    { latitude: data.latitude, longitude: data.longitude },
    { latitude: lastDpe.Latitude, longitude: lastDpe.Longitude },
  )

  const warnings: RiskWarning[] = []
  let level: 'green' | 'yellow' | 'red' = 'green'

  if (km > DISTANCE_THRESHOLDS.critical_km) {
    level = 'red'
    warnings.push({
      axis: 'distance',
      severity: 'error',
      code: 'DISTANCE_CRITICAL',
      message: `${km.toFixed(1)} km depuis votre dernier DPE — anormalement élevé (seuil ${DISTANCE_THRESHOLDS.critical_km} km).`,
      suggested_fix: 'Confirmer si vous opérez sur un secteur étendu ce jour-là.',
      context: { km, threshold: DISTANCE_THRESHOLDS.critical_km },
    })
  } else if (km > DISTANCE_THRESHOLDS.warning_km) {
    level = 'yellow'
    warnings.push({
      axis: 'distance',
      severity: 'warning',
      code: 'DISTANCE_WARNING',
      message: `${km.toFixed(1)} km depuis votre dernier DPE — vérifier la cohérence du déplacement.`,
      context: { km, threshold: DISTANCE_THRESHOLDS.warning_km },
    })
  }

  return { km_from_last: Number(km.toFixed(2)), level, warnings }
}

// ============================================================
// Check : Cohérence (règles métier en DB)
// ============================================================

export function checkCoherenceRules(
  data: PrevalidationInput,
  rules: CoherenceRule[],
): CoherenceCheckResult {
  const warnings: RiskWarning[] = []
  let rulesChecked = 0
  let rulesViolated = 0

  for (const rule of rules) {
    if (!rule.enabled) continue
    rulesChecked += 1
    const violated = evaluateRule(rule.rule_logic, data as unknown as Record<string, unknown>)
    if (!violated) continue
    rulesViolated += 1
    warnings.push({
      axis: 'coherence',
      severity: rule.severity,
      code: rule.rule_code,
      message: rule.description,
      ...(rule.suggested_fix !== null ? { suggested_fix: rule.suggested_fix } : {}),
      context: { rule_id: rule.id, title: rule.title },
    })
  }

  return { rules_checked: rulesChecked, rules_violated: rulesViolated, warnings }
}

// ============================================================
// Check : Statistique (vs national + courant org)
// ============================================================

export function checkStatisticalRisk(
  snapshot: LatestSnapshot | null,
  data: PrevalidationInput,
): StatisticalCheckResult {
  const warnings: RiskWarning[] = []

  // 1. Étiquette saisie vs distribution nationale (alerte si A/B sur ancien bâti).
  const isOldBuilding = data.annee_construction < 1975
  const isExcellentLabel = data.etiquette_dpe === 'A' || data.etiquette_dpe === 'B'
  if (isOldBuilding && isExcellentLabel) {
    warnings.push({
      axis: 'statistical',
      severity: 'warning',
      code: 'STAT_OLD_BUILDING_EXCELLENT_LABEL',
      message: `Étiquette ${data.etiquette_dpe} sur un bâtiment de ${data.annee_construction} — combinaison statistiquement rare. Vérifier les justifications (rénovation lourde documentée ?).`,
      suggested_fix: 'Annexer les factures travaux + diagnostic thermique antérieur.',
      context: { annee: data.annee_construction, etiquette: data.etiquette_dpe },
    })
  }

  // 2. Ratio F/G du cabinet vs médiane nationale
  let orgFgRatio: number | null = null
  let delta: number | null = null
  if (snapshot) {
    orgFgRatio = snapshot.ratio_fg
    delta = NATIONAL_FG_RATIO - snapshot.ratio_fg
    if (delta > STATISTICAL_TOLERANCE) {
      warnings.push({
        axis: 'statistical',
        severity: 'warning',
        code: 'STAT_FG_UNDERREPRESENTED',
        message: `Votre cabinet déclare ${(snapshot.ratio_fg * 100).toFixed(1)}% de F/G vs ${(NATIONAL_FG_RATIO * 100).toFixed(1)}% national — sous-représentation significative.`,
        suggested_fix: "S'assurer de l'absence de biais systémique (calculs PAC, ventilation, ECS).",
        context: { org_ratio: snapshot.ratio_fg, national_ratio: NATIONAL_FG_RATIO, delta },
      })
    }
  }

  // 3. Frontière D/E "tassement" (heuristique : DPE à la limite haute de E)
  if (data.etiquette_dpe === 'E' && data.conso_5_usages_par_m2_ep > 320) {
    warnings.push({
      axis: 'statistical',
      severity: 'info',
      code: 'STAT_FRONTIER_DE',
      message: `Consommation ${data.conso_5_usages_par_m2_ep} kWh/m²/an proche de la frontière E/F (330). Vérifier le calcul.`,
      context: { conso: data.conso_5_usages_par_m2_ep },
    })
  }

  return { org_fg_ratio: orgFgRatio, delta_vs_national: delta, warnings }
}

// ============================================================
// Check : Cohérence historique utilisateur
// ============================================================

export function checkConsistencyWithHistory(
  history: UserHistoryAggregate | null,
  data: PrevalidationInput,
): HistoryCheckResult {
  const warnings: RiskWarning[] = []
  if (!history || history.total_dpe === 0) {
    return { user_fg_ratio: null, user_avg_surface: null, warnings }
  }

  const userFgRatio = history.fg_count / history.total_dpe

  // Cas 1 : user fait habituellement bcp de F/G mais déclare étiquette A
  if (userFgRatio > 0.5 && (data.etiquette_dpe === 'A' || data.etiquette_dpe === 'B')) {
    warnings.push({
      axis: 'history',
      severity: 'warning',
      code: 'HIST_UNUSUAL_LABEL',
      message: `Habituellement ${(userFgRatio * 100).toFixed(0)}% de F/G chez vous — étiquette ${data.etiquette_dpe} inhabituelle. Vérifier la saisie.`,
      context: { user_fg_ratio: userFgRatio, current_label: data.etiquette_dpe },
    })
  }

  // Cas 2 : surface très éloignée de la moyenne (anomalie de saisie potentielle)
  if (history.avg_surface_m2 !== null && history.avg_surface_m2 > 0) {
    const ratio = data.surface_habitable_m2 / history.avg_surface_m2
    if (ratio < 0.2 || ratio > 5) {
      warnings.push({
        axis: 'history',
        severity: 'info',
        code: 'HIST_UNUSUAL_SURFACE',
        message: `Surface ${data.surface_habitable_m2} m² très différente de votre moyenne (${history.avg_surface_m2.toFixed(0)} m²).`,
        context: { ratio, avg: history.avg_surface_m2 },
      })
    }
  }

  return {
    user_fg_ratio: Number(userFgRatio.toFixed(4)),
    user_avg_surface: history.avg_surface_m2,
    warnings,
  }
}

// ============================================================
// Helpers scoring
// ============================================================

function scoreFromLevel(level: 'green' | 'yellow' | 'red'): number {
  if (level === 'red') return 100
  if (level === 'yellow') return 50
  return 0
}

function scoreCoherenceAxis(result: CoherenceCheckResult): number {
  if (result.rules_checked === 0) return 0
  const errors = result.warnings.filter(
    (w) => w.severity === 'error' || w.severity === 'blocking',
  ).length
  const warns = result.warnings.filter((w) => w.severity === 'warning').length
  // 1 erreur = 60 pts, 1 warning = 20 pts, plafonné 100.
  return Math.min(100, errors * 60 + warns * 20)
}

function scoreStatisticalAxis(result: StatisticalCheckResult): number {
  const warns = result.warnings.length
  if (warns === 0) return 0
  if (warns >= 3) return 100
  return warns * 35
}
