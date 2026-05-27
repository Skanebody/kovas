/**
 * KOVAS — Algo 22 : Upsell timing prediction.
 *
 * Pure function qui détermine si MAINTENANT est un bon moment pour proposer
 * un upgrade ou un addon à un abonné. Score 0-100 + recommandation
 * (offer | wait | skip) + raisons humaines.
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` (Système 5 + Algo 22).
 *
 * Stratégie :
 *   - Récompenser les signaux d'engagement positif (quota qui grimpe,
 *     satisfaction haute, health score bon).
 *   - Pénaliser les anti-patterns (récent offer ignoré, user stressé/saturé,
 *     santé client dégradée, signaux churn).
 *   - Bonus contextuel : tenure dans la sweet spot M1-M12.
 *
 * Déterministe, testable, zéro IO. Consomme A1.3.11 (churn predictor) via
 * `recent_health_score`. Le caller assemble les inputs depuis subscriptions
 * + activity + cancellations + last_offers.
 */

export type UpsellRecommendation = 'offer' | 'wait' | 'skip'

export type QuotaTrend = 'increasing' | 'stable' | 'decreasing'

export type Workload = 'high' | 'medium' | 'low'

export interface UpsellTimingInput {
  /** Mois d'ancienneté (M1, M2, etc.) */
  tenure_months: number
  /** Tendance d'utilisation du quota mensuel sur les 30 derniers jours */
  quota_usage_trend: QuotaTrend
  /** % du quota utilisé mois courant (0-100, null = plan illimité) */
  quota_usage_pct: number | null
  /** Score satisfaction récent 0-10 (NPS-like, null = pas mesuré) */
  recent_satisfaction_score: number | null
  /** Health score user 0-100 (cf. AI_AUTONOMY_V1 §14) */
  recent_health_score: number | null
  /** Risque churn 0-100 (A1.3.11) */
  recent_churn_score: number | null
  /** User a-t-il déjà vu une offre similaire récemment ? */
  has_seen_similar_offer: boolean
  /** Jours depuis le dernier offer envoyé (tous types confondus, null = jamais) */
  days_since_last_offer: number | null
  /** Charge de travail estimée (proxy : missions cette semaine) */
  current_workload: Workload
  /** A complété son onboarding ? */
  onboarding_completed: boolean
  /** Statut Stripe — uniquement 'active' permet l'offer */
  subscription_active: boolean
}

export interface UpsellSignal {
  code: string
  label: string
  points: number
  detail: string
}

export interface UpsellTimingResult {
  /** Score 0-100 (60+ = offer recommandé) */
  score: number
  /** Recommandation finale */
  recommendation: UpsellRecommendation
  /** Détail des contributions */
  signals: ReadonlyArray<UpsellSignal>
  /** Phrase humaine prête à afficher (admin UI) */
  human_message: string
  /** Confidence 0-1 (1 = tous signaux non-null) */
  confidence: number
}

/**
 * Pondérations (max ~100 pts positifs, jusqu'à -100 négatifs) :
 *
 * Signaux positifs (max 100 pts) :
 *   - quota_usage_trend=increasing      : +30
 *   - recent_health_score > 70           : +25
 *   - recent_satisfaction_score >= 7     : +20
 *   - tenure_months in [1, 12]           : +15
 *   - current_workload != high           : +10
 *
 * Anti-patterns (jusqu'à -100 pts) :
 *   - has_seen_similar_offer && cooldown : -50
 *   - recent_health_score < 40           : -30
 *   - recent_churn_score >= 50           : -40
 *   - !subscription_active               : -100 (force skip)
 *   - !onboarding_completed              : -25
 *
 * Score final = clamp(somme, 0, 100).
 */

function pointsForQuotaTrend(
  trend: QuotaTrend,
  pct: number | null,
): { points: number; detail: string } {
  if (trend === 'increasing') {
    if (pct != null && pct >= 80) {
      return { points: 35, detail: `Quota à ${pct}% en hausse — moment idéal pour upgrade` }
    }
    return { points: 30, detail: "Consommation en hausse — signal d'expansion" }
  }
  if (trend === 'stable') {
    return { points: 5, detail: 'Consommation stable' }
  }
  return { points: -10, detail: 'Consommation en baisse — éviter de pousser maintenant' }
}

function pointsForHealthScore(score: number | null): {
  points: number
  detail: string
} {
  if (score == null) {
    return { points: 0, detail: 'Health score non disponible' }
  }
  if (score >= 70) {
    return { points: 25, detail: `Health score élevé (${score}/100)` }
  }
  if (score >= 50) {
    return { points: 10, detail: `Health score correct (${score}/100)` }
  }
  if (score >= 40) {
    return { points: -10, detail: `Health score limite (${score}/100)` }
  }
  return { points: -30, detail: `Health score faible (${score}/100) — focus retention` }
}

function pointsForSatisfaction(score: number | null): {
  points: number
  detail: string
} {
  if (score == null) {
    return { points: 0, detail: 'Satisfaction non mesurée' }
  }
  if (score >= 8) {
    return { points: 20, detail: `Satisfaction excellente (${score}/10)` }
  }
  if (score >= 7) {
    return { points: 15, detail: `Satisfaction bonne (${score}/10)` }
  }
  if (score >= 5) {
    return { points: 0, detail: `Satisfaction neutre (${score}/10)` }
  }
  return { points: -15, detail: `Satisfaction faible (${score}/10) — éviter offer` }
}

function pointsForTenure(months: number): { points: number; detail: string } {
  if (months >= 1 && months <= 12) {
    return { points: 15, detail: `Sweet spot tenure (M${months})` }
  }
  if (months < 1) {
    return { points: -20, detail: "Trop tôt (moins d'1 mois) — laisser maturer" }
  }
  // M13+
  return { points: 5, detail: `Tenure mature (M${months}) — upsell ciblé OK` }
}

function pointsForWorkload(workload: Workload): { points: number; detail: string } {
  if (workload === 'low') {
    return { points: 10, detail: 'Charge légère — bonne fenêtre attentionnelle' }
  }
  if (workload === 'medium') {
    return { points: 5, detail: 'Charge modérée' }
  }
  return { points: -10, detail: 'Charge intense — éviter de déranger' }
}

function pointsForChurnRisk(score: number | null): { points: number; detail: string } {
  if (score == null) {
    return { points: 0, detail: 'Risque churn non calculé' }
  }
  if (score >= 70) {
    return { points: -50, detail: `Risque churn critique (${score}/100) — priorité retention` }
  }
  if (score >= 50) {
    return { points: -40, detail: `Risque churn élevé (${score}/100)` }
  }
  if (score >= 25) {
    return { points: -10, detail: `Risque churn modéré (${score}/100)` }
  }
  return { points: 5, detail: `Risque churn faible (${score}/100)` }
}

function pointsForRecentOffer(
  hasSeen: boolean,
  days: number | null,
): { points: number; detail: string } {
  if (!hasSeen) {
    return { points: 0, detail: "Pas d'offre similaire récente" }
  }
  if (days == null) {
    return { points: -30, detail: 'Offre similaire déjà vue (date inconnue) — cooldown prudent' }
  }
  if (days < 7) {
    return { points: -60, detail: `Offre similaire il y a ${days}j — cooldown actif` }
  }
  if (days < 30) {
    return { points: -25, detail: `Offre similaire il y a ${days}j — cooldown partiel` }
  }
  return { points: 0, detail: `Offre précédente il y a ${days}j — cooldown levé` }
}

function pointsForOnboarding(completed: boolean): { points: number; detail: string } {
  if (completed) {
    return { points: 0, detail: 'Onboarding complété' }
  }
  return { points: -25, detail: 'Onboarding non terminé — finaliser avant upsell' }
}

function recommendationFromScore(score: number, subActive: boolean): UpsellRecommendation {
  if (!subActive) return 'skip'
  if (score >= 60) return 'offer'
  if (score >= 30) return 'wait'
  return 'skip'
}

function buildHumanMessage(
  rec: UpsellRecommendation,
  score: number,
  signals: ReadonlyArray<UpsellSignal>,
): string {
  if (rec === 'offer') {
    const top = signals
      .filter((s) => s.points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 2)
      .map((s) => s.detail)
    return `Bon moment pour proposer (${score}/100). ${top.join(' · ')}`
  }
  if (rec === 'wait') {
    const negs = signals
      .filter((s) => s.points < 0)
      .sort((a, b) => a.points - b.points)
      .slice(0, 1)
      .map((s) => s.detail)
    return `Attendre (${score}/100). ${negs[0] ?? 'Signaux mitigés.'}`
  }
  const blockers = signals
    .filter((s) => s.points <= -25)
    .map((s) => s.detail)
    .slice(0, 2)
  return `Ne pas envoyer d'offre (${score}/100). ${blockers.join(' · ') || 'Conditions non remplies.'}`
}

function computeConfidence(input: UpsellTimingInput): number {
  const fields = [
    input.recent_health_score,
    input.recent_satisfaction_score,
    input.recent_churn_score,
    input.quota_usage_pct,
  ]
  const present = fields.filter((v) => v != null).length
  return present / fields.length
}

/**
 * Algorithme principal — détermine si on doit proposer un upsell.
 *
 * @example
 * ```ts
 * const result = predictUpsellTiming({
 *   tenure_months: 4,
 *   quota_usage_trend: 'increasing',
 *   quota_usage_pct: 85,
 *   recent_satisfaction_score: 8,
 *   recent_health_score: 75,
 *   recent_churn_score: 12,
 *   has_seen_similar_offer: false,
 *   days_since_last_offer: null,
 *   current_workload: 'medium',
 *   onboarding_completed: true,
 *   subscription_active: true,
 * })
 * // → { score: 95, recommendation: 'offer', ... }
 * ```
 */
export function predictUpsellTiming(input: UpsellTimingInput): UpsellTimingResult {
  const signals: UpsellSignal[] = []

  // Force skip si pas d'abonnement actif
  if (!input.subscription_active) {
    return {
      score: 0,
      recommendation: 'skip',
      signals: [
        {
          code: 'subscription_inactive',
          label: 'Abonnement non actif',
          points: -100,
          detail: "Abonnement Stripe non actif (trial/past_due/canceled) — pas d'offre",
        },
      ],
      human_message:
        "Abonnement non actif — ne pas envoyer d'offre upsell tant que le statut n'est pas active.",
      confidence: 1,
    }
  }

  // Force skip si churn critique (>=70) — priorité absolue à la retention.
  // Aligné AI_AUTONOMY_V1 §7 + §11 : un user en churn critique reçoit une
  // séquence retention, jamais un upsell (qui aggraverait le sentiment).
  if (input.recent_churn_score != null && input.recent_churn_score >= 70) {
    return {
      score: 0,
      recommendation: 'skip',
      signals: [
        {
          code: 'churn_critical',
          label: 'Churn critique',
          points: -100,
          detail: `Risque churn critique (${input.recent_churn_score}/100) — priorité retention`,
        },
      ],
      human_message: `Risque churn critique (${input.recent_churn_score}/100) — déclencher retention au lieu d'upsell.`,
      confidence: 1,
    }
  }

  // 1. Quota trend (positif fort)
  const quotaSig = pointsForQuotaTrend(input.quota_usage_trend, input.quota_usage_pct)
  signals.push({
    code: 'quota_trend',
    label: 'Tendance quota',
    points: quotaSig.points,
    detail: quotaSig.detail,
  })

  // 2. Health score
  const healthSig = pointsForHealthScore(input.recent_health_score)
  signals.push({
    code: 'health_score',
    label: 'Health score',
    points: healthSig.points,
    detail: healthSig.detail,
  })

  // 3. Satisfaction
  const satSig = pointsForSatisfaction(input.recent_satisfaction_score)
  signals.push({
    code: 'satisfaction',
    label: 'Satisfaction',
    points: satSig.points,
    detail: satSig.detail,
  })

  // 4. Tenure (sweet spot M1-M12)
  const tenureSig = pointsForTenure(input.tenure_months)
  signals.push({
    code: 'tenure',
    label: 'Ancienneté',
    points: tenureSig.points,
    detail: tenureSig.detail,
  })

  // 5. Workload (negative si high)
  const workSig = pointsForWorkload(input.current_workload)
  signals.push({
    code: 'workload',
    label: 'Charge de travail',
    points: workSig.points,
    detail: workSig.detail,
  })

  // 6. Churn risk (anti-pattern)
  const churnSig = pointsForChurnRisk(input.recent_churn_score)
  signals.push({
    code: 'churn_risk',
    label: 'Risque churn',
    points: churnSig.points,
    detail: churnSig.detail,
  })

  // 7. Cooldown offer récent
  const cooldownSig = pointsForRecentOffer(
    input.has_seen_similar_offer,
    input.days_since_last_offer,
  )
  signals.push({
    code: 'recent_offer',
    label: 'Cooldown offre',
    points: cooldownSig.points,
    detail: cooldownSig.detail,
  })

  // 8. Onboarding non terminé
  const obSig = pointsForOnboarding(input.onboarding_completed)
  signals.push({
    code: 'onboarding',
    label: 'Onboarding',
    points: obSig.points,
    detail: obSig.detail,
  })

  // Somme + clamp 0-100
  const total = signals.reduce((sum, s) => sum + s.points, 0)
  const score = Math.max(0, Math.min(100, total))

  const recommendation = recommendationFromScore(score, input.subscription_active)
  const human_message = buildHumanMessage(recommendation, score, signals)
  const confidence = computeConfidence(input)

  return {
    score,
    recommendation,
    signals,
    human_message,
    confidence,
  }
}
