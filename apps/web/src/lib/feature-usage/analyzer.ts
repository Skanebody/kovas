/**
 * KOVAS — Système 10 : Feature usage learner — analyzer.
 *
 * Pure function qui classifie l'adoption d'une feature sur 30 jours en
 * buckets (dead / underused / mainstream / power), évalue le statut santé
 * (healthy / warning / critical / over_performing) et recommande une
 * action produit (kill / investigate / promote / maintain / amplify).
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §13 (Feature usage learner).
 *
 * Stratégie :
 *   - Bucket adoption_pct :
 *       · < 2%   → dead   (feature à killer)
 *       · 2-30%  → underused
 *       · 30-70% → mainstream
 *       · ≥ 70%  → power
 *   - Override "ne jamais killer une feature core" : si dead + impact=core,
 *     recommended_action devient 'investigate' (probable bug ou release ratée).
 *   - Status critical si dead + impact=core. Warning si vs_expected < 0.5.
 *   - Signals codés pour permettre l'agrégation admin (ex : compter combien
 *     de features sont en status='critical' sur la semaine).
 *
 * Déterministe, testable, zéro IO. Le caller agrège FeatureUsageStats depuis
 * PostHog data export + Supabase, puis appelle `analyzeAllFeatures(stats, FEATURES_CATALOG)`.
 *
 * Avatar SOBRE PROFESSIONNEL — vouvoiement par défaut dans human_message
 * (audience = équipe produit interne, pas le diagnostiqueur).
 */

import type { FeatureDefinition, FeatureId } from './features-catalog'

export type AdoptionBucket = 'dead' | 'underused' | 'mainstream' | 'power'

export type FeatureStatus = 'healthy' | 'warning' | 'critical' | 'over_performing'

export type RecommendedAction = 'kill' | 'investigate' | 'promote' | 'maintain' | 'amplify'

export interface FeatureUsageStats {
  feature_id: FeatureId
  /** Période d'observation — fixé à 30 jours pour V1 */
  period_days: 30
  /** Users qui ont utilisé la feature ≥ min_usage_for_active fois sur la période */
  active_users_count: number
  /** Total users actifs éligibles (tier compatible, abonnement actif) */
  total_users_count: number
  /** Somme des usages individuels sur la période */
  total_uses_count: number
  /** Moyenne usages / user actif (active_users_count seulement) */
  avg_uses_per_active_user: number
  /** Médiane usages / user actif */
  median_uses_per_active_user: number
}

export interface AnalyzerSignal {
  code: string
  detail: string
}

export interface FeatureAnalysis {
  feature_id: FeatureId
  /** Taux adoption 0-1 (active_users / total_users) */
  adoption_rate: number
  /** Taux adoption en pourcentage 0-100 */
  adoption_pct: number
  /** Bucket de classification */
  bucket: AdoptionBucket
  /** Ratio adoption_pct / expected_adoption_pct (1.0 = atteint la cible) */
  vs_expected: number
  /** Statut santé global */
  status: FeatureStatus
  /** Action recommandée à l'équipe produit */
  recommended_action: RecommendedAction
  /** Signaux détaillés pour audit + agrégation */
  signals: ReadonlyArray<AnalyzerSignal>
  /** Phrase humaine prête à afficher dans le rapport admin */
  human_message: string
}

// ---------------------------------------------------------------------------
// Bucket + action mapping
// ---------------------------------------------------------------------------

const BUCKET_THRESHOLDS = {
  dead: 2,
  underused: 30,
  mainstream: 70,
} as const

function bucketFromPct(pct: number): AdoptionBucket {
  if (pct < BUCKET_THRESHOLDS.dead) return 'dead'
  if (pct < BUCKET_THRESHOLDS.underused) return 'underused'
  if (pct < BUCKET_THRESHOLDS.mainstream) return 'mainstream'
  return 'power'
}

/**
 * Mapping bucket × impact → action recommandée.
 *
 * Règles d'override :
 *   - bucket=dead + impact=core         → 'investigate' (jamais 'kill' sur core)
 *   - bucket=underused + impact in [core, high] → 'promote'
 *   - bucket=underused + impact=low     → 'investigate' (vraiment utile ?)
 *   - bucket=underused + impact=medium  → 'promote'
 */
function actionFromBucketAndImpact(
  bucket: AdoptionBucket,
  impact: FeatureDefinition['impact'],
): RecommendedAction {
  if (bucket === 'dead') {
    return impact === 'core' ? 'investigate' : 'kill'
  }
  if (bucket === 'underused') {
    if (impact === 'core' || impact === 'high' || impact === 'medium') return 'promote'
    return 'investigate'
  }
  if (bucket === 'mainstream') return 'maintain'
  return 'amplify'
}

/**
 * Mapping statut santé global.
 *
 * Règles (ordre de priorité, premier match gagne) :
 *   - critical          si bucket=dead ET impact=core
 *   - warning           si vs_expected < 0.5 (50% sous-perform)
 *   - over_performing   si vs_expected > 1.5
 *   - healthy           sinon
 */
function statusFromAnalysis(
  bucket: AdoptionBucket,
  impact: FeatureDefinition['impact'],
  vsExpected: number,
): FeatureStatus {
  if (bucket === 'dead' && impact === 'core') return 'critical'
  if (vsExpected < 0.5) return 'warning'
  if (vsExpected > 1.5) return 'over_performing'
  return 'healthy'
}

// ---------------------------------------------------------------------------
// Signal builders
// ---------------------------------------------------------------------------

function buildBucketSignal(
  bucket: AdoptionBucket,
  pct: number,
  active: number,
  total: number,
): AnalyzerSignal {
  if (bucket === 'dead') {
    return {
      code: 'bucket_dead',
      detail: `Adoption ${pct.toFixed(1)}% < ${BUCKET_THRESHOLDS.dead}% seuil dead — feature à killer ou repenser`,
    }
  }
  if (bucket === 'underused') {
    return {
      code: 'bucket_underused',
      detail: `Adoption ${pct.toFixed(1)}% sur la plage 2-30% — sous-utilisée, à investiguer ou promouvoir`,
    }
  }
  if (bucket === 'mainstream') {
    return {
      code: 'bucket_mainstream',
      detail: `Adoption ${pct.toFixed(1)}% sur la plage 30-70% — adoption saine, à maintenir`,
    }
  }
  return {
    code: 'bucket_power',
    detail: `Power users : ${active} utilisateurs sur ${total} (${pct.toFixed(1)}%)`,
  }
}

function buildVsExpectedSignal(
  pct: number,
  expected: number,
  vsExpected: number,
): AnalyzerSignal | null {
  if (vsExpected < 0.5) {
    return {
      code: 'underperform_vs_expected',
      detail: `Adoption ${pct.toFixed(1)}% < 50% expected (${expected}%) — sous-perform vs roadmap`,
    }
  }
  if (vsExpected > 1.5) {
    return {
      code: 'overperform_vs_expected',
      detail: `Adoption ${pct.toFixed(1)}% > 150% expected (${expected}%) — sur-perform, candidate amplification`,
    }
  }
  return null
}

function buildIntensitySignal(stats: FeatureUsageStats): AnalyzerSignal | null {
  if (stats.active_users_count === 0) return null
  if (stats.avg_uses_per_active_user >= 10) {
    return {
      code: 'high_intensity',
      detail: `Intensité élevée : ${stats.avg_uses_per_active_user.toFixed(1)} usages moyens / user actif`,
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Human message
// ---------------------------------------------------------------------------

const ACTION_VERB: Record<RecommendedAction, string> = {
  kill: 'tuer la feature',
  investigate: 'investiguer (bug, UX, release ratée ?)',
  promote: 'promouvoir auprès des users non-adopters',
  maintain: 'maintenir, pas d’action urgente',
  amplify: 'amplifier (case study, marketing)',
}

function buildHumanMessage(
  feature: FeatureDefinition,
  analysis: Omit<FeatureAnalysis, 'human_message' | 'signals'>,
): string {
  const pctStr = analysis.adoption_pct.toFixed(1)
  const expectedStr = feature.expected_adoption_pct.toString()
  const action = ACTION_VERB[analysis.recommended_action]
  return `${feature.display_name} : adoption ${pctStr}% (cible ${expectedStr}%) — bucket ${analysis.bucket}, status ${analysis.status}. Recommandation : ${action}.`
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Analyse les stats d'usage d'une feature et produit une décision produit.
 *
 * @example
 * ```ts
 * const result = analyzeFeatureUsage(
 *   {
 *     feature_id: 'voice_capture',
 *     period_days: 30,
 *     active_users_count: 145,
 *     total_users_count: 200,
 *     total_uses_count: 2400,
 *     avg_uses_per_active_user: 16.5,
 *     median_uses_per_active_user: 12,
 *   },
 *   getFeature('voice_capture')!,
 * )
 * // → { bucket: 'power', status: 'healthy', recommended_action: 'amplify', ... }
 * ```
 */
export function analyzeFeatureUsage(
  stats: FeatureUsageStats,
  feature_def: FeatureDefinition,
): FeatureAnalysis {
  // 1. Adoption rate brut
  const adoption_rate =
    stats.total_users_count > 0 ? stats.active_users_count / stats.total_users_count : 0
  const adoption_pct = adoption_rate * 100

  // 2. Bucket
  const bucket = bucketFromPct(adoption_pct)

  // 3. vs_expected (ratio adoption_pct / expected_adoption_pct)
  //    Si expected = 0 (cas théorique), on retourne 0 par convention pour
  //    éviter division par zéro tout en signalant clairement le miss.
  const vs_expected =
    feature_def.expected_adoption_pct > 0 ? adoption_pct / feature_def.expected_adoption_pct : 0

  // 4. Status
  const status = statusFromAnalysis(bucket, feature_def.impact, vs_expected)

  // 5. Action recommandée
  const recommended_action = actionFromBucketAndImpact(bucket, feature_def.impact)

  // 6. Signals
  const signals: AnalyzerSignal[] = [
    buildBucketSignal(bucket, adoption_pct, stats.active_users_count, stats.total_users_count),
  ]
  const vsExpectedSignal = buildVsExpectedSignal(
    adoption_pct,
    feature_def.expected_adoption_pct,
    vs_expected,
  )
  if (vsExpectedSignal) signals.push(vsExpectedSignal)
  const intensitySignal = buildIntensitySignal(stats)
  if (intensitySignal) signals.push(intensitySignal)
  if (status === 'critical') {
    signals.push({
      code: 'core_feature_dead',
      detail: `Feature core ${feature_def.id} adoption < 2% — probable bug ou release ratée, investiguer en priorité`,
    })
  }

  // 7. Human message
  const partial = {
    feature_id: stats.feature_id,
    adoption_rate,
    adoption_pct,
    bucket,
    vs_expected,
    status,
    recommended_action,
  }
  const human_message = buildHumanMessage(feature_def, partial)

  return {
    ...partial,
    signals,
    human_message,
  }
}

/**
 * Analyse toutes les features fournies en batch.
 *
 * Ignore silencieusement les stats dont la feature n'est pas dans le catalog
 * passé (cas d'un event PostHog historique pour une feature supprimée).
 *
 * @example
 * ```ts
 * const analyses = analyzeAllFeatures(weeklyStats, FEATURES_CATALOG)
 * const critical = analyses.filter((a) => a.status === 'critical')
 * ```
 */
export function analyzeAllFeatures(
  stats_list: ReadonlyArray<FeatureUsageStats>,
  catalog: ReadonlyArray<FeatureDefinition>,
): FeatureAnalysis[] {
  const byId = new Map(catalog.map((f) => [f.id, f]))
  const results: FeatureAnalysis[] = []
  for (const stats of stats_list) {
    const def = byId.get(stats.feature_id)
    if (!def) continue
    results.push(analyzeFeatureUsage(stats, def))
  }
  return results
}
