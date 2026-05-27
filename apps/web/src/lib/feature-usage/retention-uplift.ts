/**
 * KOVAS — Système 10 : Feature usage learner — retention uplift.
 *
 * Pure function qui compare la rétention de deux cohortes (users-qui-utilisent
 * une feature vs users-qui-ne-l'utilisent-pas) à D30, D60, D90 post-signup,
 * et produit un uplift en points absolus + une recommandation produit.
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §13 (Feature usage learner).
 *
 * Stratégie :
 *   - Calcul rétention % à chaque jalon = retained_at_day_X / user_count.
 *   - Uplift = retention(users) − retention(non_users) en points absolus.
 *   - Confidence basée sur la taille d'échantillon (total + min cohorte).
 *   - Recommendation gates :
 *       · 'high_priority_promote' si d60_uplift ≥ 20pts ET confidence=high
 *       · 'consider_promote'     si d60_uplift ≥ 10pts ET confidence in {medium, high}
 *       · 'no_action'            sinon
 *   - Si une cohorte a user_count=0 → uplift=0 + confidence=low + no_action
 *     (pas de division par zéro, message explicite).
 *
 * Déterministe, testable, zéro IO. Le caller calcule les cohortes en SQL
 * (Supabase) puis appelle cette fonction par feature.
 *
 * Avatar SOBRE PROFESSIONNEL — vouvoiement dans human_message (équipe produit interne).
 */

import type { FeatureId } from './features-catalog'

export type CohortLabel = 'users' | 'non_users'

export type StatisticalConfidence = 'low' | 'medium' | 'high'

export type UpliftRecommendation = 'high_priority_promote' | 'consider_promote' | 'no_action'

export interface RetentionCohort {
  feature_id: FeatureId
  cohort_label: CohortLabel
  /** Taille de la cohorte (users qui matchent le critère feature usage) */
  user_count: number
  /** Users still active à D+30 après signup */
  retained_at_day_30: number
  /** Users still active à D+60 après signup */
  retained_at_day_60: number
  /** Users still active à D+90 après signup */
  retained_at_day_90: number
}

export interface RetentionUpliftResult {
  feature_id: FeatureId
  /** Uplift D30 en points absolus (users_pct − non_users_pct) */
  d30_uplift_pct: number
  /** Uplift D60 en points absolus */
  d60_uplift_pct: number
  /** Uplift D90 en points absolus */
  d90_uplift_pct: number
  /** Confidence basée sur sample size */
  statistical_confidence: StatisticalConfidence
  /** Recommandation produit finale */
  recommendation: UpliftRecommendation
  /** Phrase humaine pour rapport admin */
  human_message: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function retentionPct(retained: number, total: number): number {
  if (total <= 0) return 0
  return (retained / total) * 100
}

/**
 * Confidence buckets :
 *   - 'high'   si total ≥ 200 ET min(cohorte) ≥ 50
 *   - 'medium' si total ≥ 100
 *   - 'low'    sinon
 *
 * Le seuil min(cohorte) ≥ 50 sur le tier 'high' évite les uplifts trompeurs
 * quand l'une des cohortes est minuscule (ex : 195 users + 5 non_users).
 */
function confidenceFromSampleSize(
  usersCount: number,
  nonUsersCount: number,
): StatisticalConfidence {
  const total = usersCount + nonUsersCount
  const minCohort = Math.min(usersCount, nonUsersCount)
  if (total >= 200 && minCohort >= 50) return 'high'
  if (total >= 100) return 'medium'
  return 'low'
}

function recommendationFromUplift(
  d60Uplift: number,
  confidence: StatisticalConfidence,
): UpliftRecommendation {
  if (d60Uplift >= 20 && confidence === 'high') return 'high_priority_promote'
  if (d60Uplift >= 10 && (confidence === 'medium' || confidence === 'high')) {
    return 'consider_promote'
  }
  return 'no_action'
}

function buildHumanMessage(
  feature_id: FeatureId,
  d60Uplift: number,
  usersPctD60: number,
  nonUsersPctD60: number,
  total: number,
  confidence: StatisticalConfidence,
  recommendation: UpliftRecommendation,
): string {
  if (total === 0) {
    return `Feature ${feature_id} : aucune donnée de rétention disponible. Sample size insuffisant.`
  }
  const sign = d60Uplift >= 0 ? '+' : ''
  const upliftStr = `${sign}${d60Uplift.toFixed(1)} pts`
  const pctStr = `${usersPctD60.toFixed(0)}% vs ${nonUsersPctD60.toFixed(0)}%`
  const sampleStr = `sur ${total} users`
  const recLabel: Record<UpliftRecommendation, string> = {
    high_priority_promote: 'Promotion haute priorité.',
    consider_promote: 'Promotion à considérer.',
    no_action: `Pas d’action (confidence ${confidence}).`,
  }
  return `Feature ${feature_id} : ${upliftStr} rétention D60 (${pctStr}) ${sampleStr}. ${recLabel[recommendation]}`
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Calcule l'uplift de rétention entre une cohorte d'utilisateurs de la feature
 * et une cohorte de non-utilisateurs, sur les mêmes 3 jalons (D30, D60, D90).
 *
 * @param users_cohort cohorte cohort_label='users' (utilisateurs de la feature)
 * @param non_users_cohort cohorte cohort_label='non_users' (non utilisateurs)
 *
 * @throws Error si feature_id ne matche pas entre les deux cohortes ou si
 *               cohort_label est incorrect (programmation error côté caller).
 *
 * @example
 * ```ts
 * const result = computeRetentionUplift(
 *   { feature_id: 'voice_capture', cohort_label: 'users', user_count: 200,
 *     retained_at_day_30: 180, retained_at_day_60: 156, retained_at_day_90: 130 },
 *   { feature_id: 'voice_capture', cohort_label: 'non_users', user_count: 120,
 *     retained_at_day_30: 80, retained_at_day_60: 64, retained_at_day_90: 48 },
 * )
 * // → { d60_uplift_pct: 24.7, statistical_confidence: 'high',
 * //     recommendation: 'high_priority_promote', ... }
 * ```
 */
export function computeRetentionUplift(
  users_cohort: RetentionCohort,
  non_users_cohort: RetentionCohort,
): RetentionUpliftResult {
  // Garde-fous programmation errors
  if (users_cohort.feature_id !== non_users_cohort.feature_id) {
    throw new Error(
      `computeRetentionUplift: feature_id mismatch (${users_cohort.feature_id} vs ${non_users_cohort.feature_id})`,
    )
  }
  if (users_cohort.cohort_label !== 'users') {
    throw new Error(
      `computeRetentionUplift: first cohort must have cohort_label='users' (got '${users_cohort.cohort_label}')`,
    )
  }
  if (non_users_cohort.cohort_label !== 'non_users') {
    throw new Error(
      `computeRetentionUplift: second cohort must have cohort_label='non_users' (got '${non_users_cohort.cohort_label}')`,
    )
  }

  const feature_id = users_cohort.feature_id

  // 1. Rétention % par cohorte par jalon
  const usersPctD30 = retentionPct(users_cohort.retained_at_day_30, users_cohort.user_count)
  const usersPctD60 = retentionPct(users_cohort.retained_at_day_60, users_cohort.user_count)
  const usersPctD90 = retentionPct(users_cohort.retained_at_day_90, users_cohort.user_count)

  const nonUsersPctD30 = retentionPct(
    non_users_cohort.retained_at_day_30,
    non_users_cohort.user_count,
  )
  const nonUsersPctD60 = retentionPct(
    non_users_cohort.retained_at_day_60,
    non_users_cohort.user_count,
  )
  const nonUsersPctD90 = retentionPct(
    non_users_cohort.retained_at_day_90,
    non_users_cohort.user_count,
  )

  // 2. Uplift = users − non_users (points absolus)
  const d30_uplift_pct = usersPctD30 - nonUsersPctD30
  const d60_uplift_pct = usersPctD60 - nonUsersPctD60
  const d90_uplift_pct = usersPctD90 - nonUsersPctD90

  // 3. Confidence
  const statistical_confidence = confidenceFromSampleSize(
    users_cohort.user_count,
    non_users_cohort.user_count,
  )

  // 4. Recommendation
  const recommendation = recommendationFromUplift(d60_uplift_pct, statistical_confidence)

  // 5. Human message
  const total = users_cohort.user_count + non_users_cohort.user_count
  const human_message = buildHumanMessage(
    feature_id,
    d60_uplift_pct,
    usersPctD60,
    nonUsersPctD60,
    total,
    statistical_confidence,
    recommendation,
  )

  return {
    feature_id,
    d30_uplift_pct,
    d60_uplift_pct,
    d90_uplift_pct,
    statistical_confidence,
    recommendation,
    human_message,
  }
}
