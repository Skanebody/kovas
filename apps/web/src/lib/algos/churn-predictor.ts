/**
 * KOVAS — Algo A1.3.11 : Churn risk predictor.
 *
 * Pure function qui score 0-100 le risque de churn d'un abonné KOVAS en
 * combinant 7 signaux (lus depuis subscriptions + diagnosticians +
 * cancellations + activity). Le score sert à :
 *   - Cockpit admin /churn (priorisation contacts proactifs)
 *   - Trigger automatique winback offer si bucket=critical
 *   - Métriques business analytics (retention curve par cohorte)
 *
 * Déterministe, testable, zéro IO. Consomme A1.3.10 (cert urgency) en input.
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §A1.3.11.
 */

import type { UrgencyLevel } from './expiry-predictor'

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'canceled'
  | 'unpaid'

export type ChurnBucket = 'low' | 'mid' | 'high' | 'critical'

export type ChurnAction = 'none' | 'monitor' | 'email_check' | 'personal_call' | 'winback_offer'

export interface ChurnInput {
  /** Statut Stripe subscription */
  subscription_status: SubscriptionStatus
  /** Jours depuis le dernier login (null = jamais connecté) */
  days_since_last_login: number | null
  /** Activity score actuel 0-1 (composite : leads, mises à jour, avis) */
  activity_score: number | null
  /** Activity score 30 jours plus tôt (pour détection de chute) */
  activity_score_30d_ago: number | null
  /** Urgence la plus haute des certifications (A1.3.10) */
  worst_cert_urgency: UrgencyLevel
  /** % du quota mensuel consommé (0-100, null = pas de plan limité) */
  quota_usage_pct: number | null
  /** Cancellation déjà initiée (row dans cancellations sans reactivated_at) */
  cancellation_initiated: boolean
  /** Pour les essais : jours avant fin d'essai (null si pas en trial) */
  trial_ends_in_days: number | null
  /** Tickets support ouverts non résolus */
  support_tickets_open: number
}

export interface ChurnSignal {
  code: string
  label: string
  points: number
  detail: string
}

export interface ChurnPredictionResult {
  /** Score 0-100 final */
  churn_risk_score: number
  /** Bucket dérivé */
  bucket: ChurnBucket
  /** Action recommandée */
  recommended_action: ChurnAction
  /** Détail des contributions de chaque signal */
  signals: ReadonlyArray<ChurnSignal>
  /** Phrase humaine prête à l'emploi pour UI */
  human_message: string
  /** Confidence 0-1 (1 = tous signaux non-null) */
  confidence: number
}

/**
 * Pondérations totales (max 100 pts) :
 * - subscription_status     : 25 (canceled=25, past_due/unpaid=22, paused=10, trialing=8, active=0)
 * - cancellation_initiated  : 20 (boolean — flag fort)
 * - days_since_last_login   : 15 (>60j=15, >30j=10, >14j=5, <=14j=0)
 * - activity_trend (chute)  : 15 (drop >0.4=15, >0.2=8, >0.05=3, no drop=0)
 * - worst_cert_urgency      : 10 (expired=10, critical=7, urgent=4, attention=2, safe=0)
 * - quota_usage_pct (low)   : 10 (<5%=10, <15%=6, <30%=3, else=0)
 * - trial_ends_in_days      : 5  (<3j=5 si trial, sinon 0)
 *
 * Total : 100 pts max.
 */

function pointsForStatus(status: SubscriptionStatus): { points: number; detail: string } {
  switch (status) {
    case 'canceled':
      return { points: 25, detail: 'Abonnement résilié' }
    case 'unpaid':
      return { points: 22, detail: 'Impayé Stripe (recouvrement en cours)' }
    case 'past_due':
      return { points: 22, detail: 'Paiement échoué (retry Stripe)' }
    case 'paused':
      return { points: 10, detail: 'Abonnement en pause' }
    case 'trialing':
      return { points: 8, detail: "En essai (signal d'incertitude)" }
    default:
      return { points: 0, detail: 'Abonnement actif' }
  }
}

function pointsForLoginRecency(days: number | null): { points: number; detail: string } {
  if (days == null) return { points: 8, detail: 'Aucun login enregistré' }
  if (days > 60) return { points: 15, detail: `Pas de login depuis ${days} jours` }
  if (days > 30) return { points: 10, detail: `Pas de login depuis ${days} jours` }
  if (days > 14) return { points: 5, detail: `Pas de login depuis ${days} jours` }
  return { points: 0, detail: `Login récent (il y a ${days} jours)` }
}

function pointsForActivityTrend(
  current: number | null,
  prev: number | null,
): { points: number; detail: string } {
  if (current == null && prev == null) {
    return { points: 0, detail: 'Activité non mesurée' }
  }
  if (current == null) {
    return { points: 6, detail: 'Activité récente non mesurée (signal faible)' }
  }
  if (prev == null) {
    return { points: 0, detail: 'Pas de baseline pour comparer' }
  }
  const drop = prev - current
  if (drop >= 0.4) {
    return {
      points: 15,
      detail: `Chute d'activité forte : ${prev.toFixed(2)} → ${current.toFixed(2)}`,
    }
  }
  if (drop >= 0.2) {
    return {
      points: 8,
      detail: `Baisse d'activité notable : ${prev.toFixed(2)} → ${current.toFixed(2)}`,
    }
  }
  if (drop >= 0.05) {
    return {
      points: 3,
      detail: `Légère baisse : ${prev.toFixed(2)} → ${current.toFixed(2)}`,
    }
  }
  return {
    points: 0,
    detail: `Activité stable ou en hausse (${current.toFixed(2)})`,
  }
}

function pointsForCertUrgency(u: UrgencyLevel): { points: number; detail: string } {
  switch (u) {
    case 'expired':
      return { points: 10, detail: "Certification expirée (bloque l'activité)" }
    case 'critical':
      return { points: 7, detail: 'Certification expire dans 7 jours' }
    case 'urgent':
      return { points: 4, detail: 'Certification expire dans 30 jours' }
    case 'attention':
      return { points: 2, detail: 'Certification expire dans 60 jours' }
    default:
      return { points: 0, detail: 'Certifications à jour' }
  }
}

function pointsForQuotaUsage(pct: number | null): { points: number; detail: string } {
  if (pct == null) return { points: 0, detail: 'Quota illimité ou non mesuré' }
  if (pct < 5) return { points: 10, detail: `Quota très peu utilisé (${pct}%)` }
  if (pct < 15) return { points: 6, detail: `Quota peu utilisé (${pct}%)` }
  if (pct < 30) return { points: 3, detail: `Quota sous-utilisé (${pct}%)` }
  return { points: 0, detail: `Quota utilisé (${pct}%)` }
}

function pointsForTrialEnd(daysToEnd: number | null): { points: number; detail: string } {
  if (daysToEnd == null) return { points: 0, detail: 'Pas en essai' }
  if (daysToEnd < 3) {
    return { points: 5, detail: `Fin d'essai imminente (${daysToEnd}j)` }
  }
  return { points: 0, detail: `Essai actif (${daysToEnd}j restants)` }
}

function bucketFromScore(score: number): ChurnBucket {
  if (score >= 70) return 'critical'
  if (score >= 50) return 'high'
  if (score >= 25) return 'mid'
  return 'low'
}

function actionFromBucket(b: ChurnBucket, status: SubscriptionStatus): ChurnAction {
  if (b === 'critical') {
    return status === 'canceled' ? 'winback_offer' : 'personal_call'
  }
  if (b === 'high') return 'personal_call'
  if (b === 'mid') return 'email_check'
  return 'monitor'
}

function buildHumanMessage(bucket: ChurnBucket, topSignal: ChurnSignal | null): string {
  switch (bucket) {
    case 'critical':
      return topSignal
        ? `Risque de churn critique — signal principal : ${topSignal.label.toLowerCase()}. Contact direct recommandé.`
        : 'Risque de churn critique — contact direct recommandé.'
    case 'high':
      return topSignal
        ? `Risque de churn élevé — signal principal : ${topSignal.label.toLowerCase()}. Email personnalisé ou appel suggéré.`
        : 'Risque de churn élevé — relance personnalisée recommandée.'
    case 'mid':
      return 'Risque de churn modéré — check-in par email opportun.'
    default:
      return 'Risque de churn faible — abonné engagé.'
  }
}

export function predictChurnRisk(input: ChurnInput): ChurnPredictionResult {
  const signals: ChurnSignal[] = []
  let nullsCount = 0
  let totalConsidered = 0

  // 1. Subscription status (max 25)
  const status = pointsForStatus(input.subscription_status)
  signals.push({
    code: 'SUBSCRIPTION_STATUS',
    label: `Statut : ${input.subscription_status}`,
    points: status.points,
    detail: status.detail,
  })
  totalConsidered += 1

  // 2. Cancellation initiée (max 20)
  if (input.cancellation_initiated) {
    signals.push({
      code: 'CANCELLATION_FLOW',
      label: 'Cancellation initiée',
      points: 20,
      detail: 'Flow de résiliation entamé (non annulé)',
    })
  } else {
    signals.push({
      code: 'CANCELLATION_FLOW',
      label: 'Aucune cancellation en cours',
      points: 0,
      detail: 'Pas de signal de désengagement',
    })
  }
  totalConsidered += 1

  // 3. Login recency (max 15)
  const login = pointsForLoginRecency(input.days_since_last_login)
  if (input.days_since_last_login == null) nullsCount += 1
  signals.push({
    code: 'LOGIN_RECENCY',
    label: `Login il y a ${input.days_since_last_login ?? '?'} jours`,
    points: login.points,
    detail: login.detail,
  })
  totalConsidered += 1

  // 4. Activity trend (max 15)
  const trend = pointsForActivityTrend(input.activity_score, input.activity_score_30d_ago)
  if (input.activity_score == null || input.activity_score_30d_ago == null) {
    nullsCount += 1
  }
  signals.push({
    code: 'ACTIVITY_TREND',
    label: 'Tendance activité 30j',
    points: trend.points,
    detail: trend.detail,
  })
  totalConsidered += 1

  // 5. Cert urgency (max 10)
  const cert = pointsForCertUrgency(input.worst_cert_urgency)
  signals.push({
    code: 'CERT_URGENCY',
    label: `Certifications : ${input.worst_cert_urgency}`,
    points: cert.points,
    detail: cert.detail,
  })
  totalConsidered += 1

  // 6. Quota usage (max 10)
  const quota = pointsForQuotaUsage(input.quota_usage_pct)
  if (input.quota_usage_pct == null) nullsCount += 1
  signals.push({
    code: 'QUOTA_USAGE',
    label: `Quota mensuel : ${input.quota_usage_pct ?? '?'}%`,
    points: quota.points,
    detail: quota.detail,
  })
  totalConsidered += 1

  // 7. Trial end (max 5)
  const trial = pointsForTrialEnd(input.trial_ends_in_days)
  signals.push({
    code: 'TRIAL_END',
    label:
      input.trial_ends_in_days != null ? `Essai : J-${input.trial_ends_in_days}` : 'Pas en essai',
    points: trial.points,
    detail: trial.detail,
  })
  totalConsidered += 1

  // 8. Tickets support (bonus +3 par ticket ouvert, plafonné 9 — pondération soft)
  if (input.support_tickets_open > 0) {
    const ticketPoints = Math.min(9, input.support_tickets_open * 3)
    signals.push({
      code: 'SUPPORT_TICKETS',
      label: `${input.support_tickets_open} ticket(s) ouvert(s)`,
      points: ticketPoints,
      detail: 'Tickets support non résolus = friction',
    })
  }

  const churnScore = Math.min(
    100,
    signals.reduce((acc, s) => acc + s.points, 0),
  )
  const bucket = bucketFromScore(churnScore)
  const recommendedAction = actionFromBucket(bucket, input.subscription_status)

  // Top signal (le plus de points) pour la phrase humaine
  const topSignal =
    [...signals].sort((a, b) => b.points - a.points).find((s) => s.points > 0) ?? null

  const confidence = Math.max(0.6, 1 - nullsCount / Math.max(1, totalConsidered))

  return {
    churn_risk_score: churnScore,
    bucket,
    recommended_action: recommendedAction,
    signals,
    human_message: buildHumanMessage(bucket, topSignal),
    confidence,
  }
}
