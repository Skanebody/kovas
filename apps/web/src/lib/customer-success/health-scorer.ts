/**
 * KOVAS — Système 11 (partie retention) : Customer health scorer.
 *
 * Pure function qui calcule un health score composite 0-100 pour un abonné
 * KOVAS en combinant 5 dimensions (engagement, product adoption, performance,
 * satisfaction, business). Le score sert à :
 *   - Cockpit admin /customer-success (priorisation contacts proactifs)
 *   - Trigger automatique des interventions retention via action-decider.ts
 *   - Métriques business analytics (santé cohorte par tier / tenure)
 *
 * ⚠️ Phase 3 reminder : ce lot ne contient PAS de chat IA conversationnel
 * (réservé Phase 3 M19+, risque hallucinations réglementaires ADEME/3CL
 * inacceptable Phase 1). Cf. CLAUDE.md §3 + AI_AUTONOMY_V1 §11.
 *
 * Déterministe, testable, zéro IO. Consomme A1.3.11 (churn predictor) et
 * Système 9 (sentiment monitoring) via inputs facultatifs.
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §14 (Customer success automation).
 */

export type HealthBucket = 'critical' | 'at_risk' | 'healthy' | 'promoter'

export type PaymentStatus = 'active' | 'trialing' | 'past_due' | 'paused' | 'canceled' | 'unpaid'

export interface HealthScoreInput {
  // Dimension 1 — Engagement (30% du score)
  logins_last_30d: number
  missions_completed_last_30d: number

  // Dimension 2 — Product adoption (25% du score) — 12 features V1 trackées
  features_used_last_30d_count: number

  // Dimension 3 — Performance (20% du score)
  cross_check_avg_score: number | null // 0-100, null si non mesuré

  // Dimension 4 — Satisfaction (15% du score)
  sentiment_avg_last_30d: number | null // -1 à +1 (Système 9), null si non mesuré

  // Dimension 5 — Business (10% du score)
  payment_status: PaymentStatus
  failed_payments_last_90d: number

  // Métadonnées
  tenure_months: number
}

export type HealthDimension =
  | 'engagement'
  | 'product_adoption'
  | 'performance'
  | 'satisfaction'
  | 'business'

export interface HealthScoreSignal {
  dimension: HealthDimension
  /** Score 0-100 pour cette dimension */
  score: number
  /** Part du composite (somme = 1) */
  weight: number
  /** Phrase humaine montrable en admin UI */
  detail: string
}

export interface HealthScoreResult {
  /** Score composite 0-100 (entier) */
  score: number
  bucket: HealthBucket
  dimensions: ReadonlyArray<HealthScoreSignal>
  /** V2 : comparaison avec score précédent (M+1) */
  trend: 'unknown'
  human_message: string
}

// ---------------------------------------------------------------------------
// Poids dimensions — somme = 1.00
// ---------------------------------------------------------------------------

const WEIGHT_ENGAGEMENT = 0.3
const WEIGHT_PRODUCT_ADOPTION = 0.25
const WEIGHT_PERFORMANCE = 0.2
const WEIGHT_SATISFACTION = 0.15
const WEIGHT_BUSINESS = 0.1

// ---------------------------------------------------------------------------
// Calculs par dimension
// ---------------------------------------------------------------------------

/**
 * Dimension 1 — Engagement (0-100).
 *   - 20 logins/mois  = 100 sur score_logins
 *   - 30 missions/mois = 100 sur score_missions
 *   - Moyenne arithmétique pondérée 50/50
 */
function scoreEngagement(input: HealthScoreInput): HealthScoreSignal {
  const score_logins = Math.min(100, (input.logins_last_30d / 20) * 100)
  const score_missions = Math.min(100, (input.missions_completed_last_30d / 30) * 100)
  const score = Math.round(score_logins * 0.5 + score_missions * 0.5)

  return {
    dimension: 'engagement',
    score,
    weight: WEIGHT_ENGAGEMENT,
    detail: `${input.logins_last_30d} login(s) · ${input.missions_completed_last_30d} mission(s) sur 30j`,
  }
}

/**
 * Dimension 2 — Product adoption (0-100).
 *   - 8 features sur 12 = 100 (on n'attend pas qu'ils utilisent les 12).
 */
function scoreProductAdoption(input: HealthScoreInput): HealthScoreSignal {
  const score = Math.round(Math.min(100, (input.features_used_last_30d_count / 8) * 100))

  return {
    dimension: 'product_adoption',
    score,
    weight: WEIGHT_PRODUCT_ADOPTION,
    detail: `${input.features_used_last_30d_count}/12 features utilisées sur 30j`,
  }
}

/**
 * Dimension 3 — Performance (0-100).
 *   - cross_check_avg_score si mesuré (déjà 0-100).
 *   - 50 (neutre) sinon.
 */
function scorePerformance(input: HealthScoreInput): HealthScoreSignal {
  if (input.cross_check_avg_score == null) {
    return {
      dimension: 'performance',
      score: 50,
      weight: WEIGHT_PERFORMANCE,
      detail: 'Performance non mesurée (cross-check non disponible)',
    }
  }
  const score = Math.round(Math.max(0, Math.min(100, input.cross_check_avg_score)))
  return {
    dimension: 'performance',
    score,
    weight: WEIGHT_PERFORMANCE,
    detail: `Cross-check moyen ${score}/100 sur 30j`,
  }
}

/**
 * Dimension 4 — Satisfaction (0-100).
 *   - sentiment_avg ∈ [-1, +1] → mapping linéaire 0-100 ((s+1)*50).
 *   - 60 (légèrement positif) si non mesuré.
 */
function scoreSatisfaction(input: HealthScoreInput): HealthScoreSignal {
  if (input.sentiment_avg_last_30d == null) {
    return {
      dimension: 'satisfaction',
      score: 60,
      weight: WEIGHT_SATISFACTION,
      detail: 'Sentiment non mesuré — baseline neutre positive',
    }
  }
  const clamped = Math.max(-1, Math.min(1, input.sentiment_avg_last_30d))
  const score = Math.round((clamped + 1) * 50)
  return {
    dimension: 'satisfaction',
    score,
    weight: WEIGHT_SATISFACTION,
    detail: `Sentiment moyen ${clamped.toFixed(2)} sur 30j (-1 négatif, +1 positif)`,
  }
}

/**
 * Dimension 5 — Business (0-100).
 *   - active : 100
 *   - trialing : 80
 *   - past_due : 30 - (failed_payments × 10), clampé 0+
 *   - paused : 40
 *   - canceled / unpaid : 0
 *   - Bonus tenure capé : +5 si >= 6 mois, +10 si >= 12 mois.
 */
function scoreBusiness(input: HealthScoreInput): HealthScoreSignal {
  let base: number
  let label: string
  switch (input.payment_status) {
    case 'active':
      base = 100
      label = 'Abonnement actif'
      break
    case 'trialing':
      base = 80
      label = 'En essai (en cours de conversion)'
      break
    case 'past_due':
      base = Math.max(0, 30 - input.failed_payments_last_90d * 10)
      label = `Paiement échoué (${input.failed_payments_last_90d} échec(s) 90j)`
      break
    case 'paused':
      base = 40
      label = 'Abonnement en pause'
      break
    default:
      base = 0
      label = input.payment_status === 'canceled' ? 'Abonnement résilié' : 'Impayé'
      break
  }

  let bonus = 0
  if (input.tenure_months >= 12) {
    bonus = 10
  } else if (input.tenure_months >= 6) {
    bonus = 5
  }

  const score = Math.min(100, base + bonus)

  return {
    dimension: 'business',
    score,
    weight: WEIGHT_BUSINESS,
    detail: `${label} · tenure M${input.tenure_months}`,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bucketFromScore(score: number): HealthBucket {
  if (score >= 80) return 'promoter'
  if (score >= 60) return 'healthy'
  if (score >= 40) return 'at_risk'
  return 'critical'
}

const BUCKET_LABEL_FR: Record<HealthBucket, string> = {
  critical: 'Health critique',
  at_risk: 'Health à risque',
  healthy: 'Health correct',
  promoter: 'Health excellent',
}

function buildHumanMessage(
  bucket: HealthBucket,
  score: number,
  dimensions: ReadonlyArray<HealthScoreSignal>,
): string {
  const engagement = dimensions.find((d) => d.dimension === 'engagement')?.score ?? 0
  const adoption = dimensions.find((d) => d.dimension === 'product_adoption')?.score ?? 0
  return `${BUCKET_LABEL_FR[bucket]} (${score}/100) · engagement ${engagement}/100 · adoption ${adoption}/100`
}

// ---------------------------------------------------------------------------
// Algorithme principal
// ---------------------------------------------------------------------------

/**
 * Calcule le health score composite d'un abonné KOVAS.
 *
 * @example
 * ```ts
 * const result = computeHealthScore({
 *   logins_last_30d: 18,
 *   missions_completed_last_30d: 25,
 *   features_used_last_30d_count: 7,
 *   cross_check_avg_score: 82,
 *   sentiment_avg_last_30d: 0.6,
 *   payment_status: 'active',
 *   failed_payments_last_90d: 0,
 *   tenure_months: 8,
 * })
 * // → { score: 82, bucket: 'promoter', ... }
 * ```
 */
export function computeHealthScore(input: HealthScoreInput): HealthScoreResult {
  const dimensions: HealthScoreSignal[] = [
    scoreEngagement(input),
    scoreProductAdoption(input),
    scorePerformance(input),
    scoreSatisfaction(input),
    scoreBusiness(input),
  ]

  const weightedSum = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0)
  const score = Math.round(Math.max(0, Math.min(100, weightedSum)))
  const bucket = bucketFromScore(score)
  const human_message = buildHumanMessage(bucket, score, dimensions)

  return {
    score,
    bucket,
    dimensions,
    trend: 'unknown',
    human_message,
  }
}
