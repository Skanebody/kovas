/**
 * KOVAS — Système 11 (partie retention) : Action decider.
 *
 * Pure function qui décide des actions automatiques à déclencher selon le
 * health bucket calculé par `health-scorer.ts`. Anti-spam et exclusions
 * contextuelles (essai en cours, contact récent, programme parrainage actif).
 *
 * ⚠️ Phase 3 reminder : aucune action ici ne déclenche un chat IA
 * conversationnel (réservé Phase 3 M19+). Les escalades critiques passent par
 * Benjamin en personne (email manuel ou visio 15 min).
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §14 (Customer success automation).
 * Déterministe, testable, zéro IO.
 */

import type { HealthBucket, HealthScoreResult } from './health-scorer'

export type AutoAction =
  // Pour critical
  | 'send_founder_personal_email'
  | 'offer_call_15min'
  | 'pause_marketing_emails'
  | 'alert_benjamin_slack'
  // Pour at_risk
  | 'send_helpful_tip_email'
  | 'offer_onboarding_help'
  | 'suggest_underused_feature'
  // Pour healthy
  | 'suggest_addon'
  | 'send_monthly_recap_email'
  // Pour promoter
  | 'request_review'
  | 'request_referral'
  | 'invite_to_case_study'

export interface ActionContext {
  /** Le programme parrainage 7 niveaux (task #150) est-il actif côté user ? */
  has_active_referral_program: boolean
  /** A laissé une review publique récente (< 90j) */
  has_left_review_recently: boolean
  /** A été contacté récemment (< 14j) — anti-spam global */
  has_been_contacted_recently: boolean
  /** Statut Stripe trialing en cours */
  is_in_trial: boolean
  tenure_months: number
}

export interface ActionPlan {
  bucket: HealthBucket
  /** Action prioritaire à déclencher (peut être null si tout est anti-spammé) */
  primary_action: AutoAction
  /** Actions secondaires (peuvent être filtrées par anti-spam) */
  secondary_actions: ReadonlyArray<AutoAction>
  /** Phrase humaine pour cockpit admin */
  human_explanation: string
}

// ---------------------------------------------------------------------------
// Décisions par bucket
// ---------------------------------------------------------------------------

interface RawDecision {
  primary: AutoAction
  secondary: ReadonlyArray<AutoAction>
  reason: string
}

function decideCritical(score: number, context: ActionContext): RawDecision {
  // Si déjà contacté < 14j, on n'envoie pas un nouvel email perso → Slack seul.
  if (context.has_been_contacted_recently) {
    return {
      primary: 'alert_benjamin_slack',
      secondary: ['pause_marketing_emails'],
      reason: `Health critique (${score}/100) mais déjà contacté < 14j — Slack alert seul + pause marketing.`,
    }
  }
  return {
    primary: 'send_founder_personal_email',
    secondary: ['offer_call_15min', 'pause_marketing_emails', 'alert_benjamin_slack'],
    reason: `Health critique (${score}/100). Email perso Benjamin + invite visio 15 min + Slack alert.`,
  }
}

function decideAtRisk(score: number, context: ActionContext): RawDecision {
  if (context.is_in_trial) {
    return {
      primary: 'offer_onboarding_help',
      secondary: ['suggest_underused_feature'],
      reason: `Health à risque (${score}/100). Aide onboarding (essai en cours).`,
    }
  }
  return {
    primary: 'send_helpful_tip_email',
    secondary: ['suggest_underused_feature'],
    reason: `Health à risque (${score}/100). Email tip métier ciblé.`,
  }
}

function decideHealthy(score: number, context: ActionContext): RawDecision {
  if (context.tenure_months >= 2) {
    return {
      primary: 'suggest_addon',
      secondary: [],
      reason: `Health correct (${score}/100). Suggestion expansion (addon).`,
    }
  }
  return {
    primary: 'send_monthly_recap_email',
    secondary: [],
    reason: `Health correct (${score}/100). Récap mensuel (tenure < 2 mois).`,
  }
}

function decidePromoter(score: number, context: ActionContext): RawDecision {
  if (context.has_active_referral_program && context.tenure_months >= 3) {
    return {
      primary: 'request_referral',
      secondary: [],
      reason: `Health excellent (${score}/100). Activer le promoteur via parrainage.`,
    }
  }
  if (!context.has_left_review_recently && context.tenure_months >= 2) {
    return {
      primary: 'request_review',
      secondary: [],
      reason: `Health excellent (${score}/100). Demande d'avis publique.`,
    }
  }
  return {
    primary: 'invite_to_case_study',
    secondary: [],
    reason: `Health excellent (${score}/100). Invitation case study.`,
  }
}

// ---------------------------------------------------------------------------
// Anti-spam global et exclusions contextuelles
// ---------------------------------------------------------------------------

/** Actions à exclure pour un user en essai (focus activation d'abord). */
const TRIAL_EXCLUDED_ACTIONS: ReadonlySet<AutoAction> = new Set<AutoAction>([
  'suggest_addon',
  'request_referral',
])

function applyContextFilters(
  raw: RawDecision,
  bucket: HealthBucket,
  context: ActionContext,
): { primary: AutoAction; secondary: ReadonlyArray<AutoAction> } {
  let secondary = [...raw.secondary]

  // Anti-spam global : si contacté < 14j, on garde primary uniquement pour
  // critical/promoter (les buckets intermédiaires attendent un cycle).
  if (context.has_been_contacted_recently) {
    secondary = []
    if (bucket !== 'critical' && bucket !== 'promoter') {
      // Retombe sur primary "neutre" non-intrusive : Slack alert pour at_risk,
      // recap mensuel pour healthy. On garde le primary tel quel mais
      // sans secondary.
    }
  }

  // Exclusions trial : on retire addon / referral et on remplace par
  // alternative si primary est concerné.
  if (context.is_in_trial && TRIAL_EXCLUDED_ACTIONS.has(raw.primary)) {
    const alt: AutoAction =
      raw.primary === 'suggest_addon' ? 'send_monthly_recap_email' : 'request_review'
    return {
      primary: alt,
      secondary: secondary.filter((a) => !TRIAL_EXCLUDED_ACTIONS.has(a)),
    }
  }

  return {
    primary: raw.primary,
    secondary: secondary.filter((a) => !context.is_in_trial || !TRIAL_EXCLUDED_ACTIONS.has(a)),
  }
}

// ---------------------------------------------------------------------------
// Algorithme principal
// ---------------------------------------------------------------------------

/**
 * Décide des actions retention à déclencher selon le health bucket d'un user.
 *
 * @example
 * ```ts
 * const health = computeHealthScore(input)
 * const plan = decideActions(health, {
 *   has_active_referral_program: true,
 *   has_left_review_recently: false,
 *   has_been_contacted_recently: false,
 *   is_in_trial: false,
 *   tenure_months: 6,
 * })
 * // → { bucket: 'promoter', primary_action: 'request_referral', ... }
 * ```
 */
export function decideActions(
  health_result: HealthScoreResult,
  context: ActionContext,
): ActionPlan {
  const { bucket, score } = health_result

  let raw: RawDecision
  switch (bucket) {
    case 'critical':
      raw = decideCritical(score, context)
      break
    case 'at_risk':
      raw = decideAtRisk(score, context)
      break
    case 'healthy':
      raw = decideHealthy(score, context)
      break
    default:
      raw = decidePromoter(score, context)
      break
  }

  const filtered = applyContextFilters(raw, bucket, context)

  return {
    bucket,
    primary_action: filtered.primary,
    secondary_actions: filtered.secondary,
    human_explanation: raw.reason,
  }
}
