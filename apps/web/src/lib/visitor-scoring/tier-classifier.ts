/**
 * KOVAS — Système 8 : Lead scoring temps réel (visiteurs site marketing).
 *
 * Classifie le `VisitorScoreResult` en tier (hot/warm/cold/cold_anonymous)
 * + actions auto + intensité d'affichage. Le caller injecte la
 * `VisitorClassification` dans les server components / middleware pour
 * personnaliser le messaging.
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §11 (Lead scoring temps réel).
 *
 * Déterministe, testable, zéro IO.
 */

import type { VisitorBehavior } from './behavior-tracker'
import type { VisitorScoreResult } from './score-calculator'

export type VisitorTier = 'hot' | 'warm' | 'cold' | 'cold_anonymous'

export type AutoAction =
  | 'show_trial_cta_primary'
  | 'show_demo_cta'
  | 'show_lead_magnet'
  | 'show_learn_more'
  | 'trigger_nurture_sequence'
  | 'trigger_hot_lead_email'
  | 'slack_alert_benjamin'
  | 'capture_email_softly'
  | 'no_action'

export type MessageIntensity = 'discreet' | 'normal' | 'prominent'

export interface VisitorClassification {
  /** Score 0-100 du `VisitorScoreResult` */
  score: number
  /** Tier final */
  tier: VisitorTier
  /** Action principale à déclencher côté UI */
  primary_action: AutoAction
  /** Actions secondaires (email, slack, etc.) */
  secondary_actions: ReadonlyArray<AutoAction>
  /** Intensité d'affichage du CTA primary */
  message_intensity: MessageIntensity
  /** Afficher le pricing inline sur la home / landing */
  show_pricing_inline: boolean
  /** Afficher le widget calculateur DPE intégré */
  show_calculator_widget: boolean
  /** Message humain prêt à afficher (admin UI debug) */
  human_message: string
}

/**
 * Tier rules :
 *
 *   - hot              : score >= 70 ET (pricing OU calculator completion)
 *   - warm             : score >= 40
 *   - cold             : score >= 15 ET (page_count >= 2 OU time >= 30s)
 *   - cold_anonymous   : sinon
 */
function determineTier(score: number, behavior: VisitorBehavior): VisitorTier {
  const hasCommercialSignal =
    behavior.has_visited_pricing || behavior.has_used_calculator_to_completion
  if (score >= 70 && hasCommercialSignal) return 'hot'
  if (score >= 40) return 'warm'
  if (score >= 15 && (behavior.page_count >= 2 || behavior.time_on_site_seconds >= 30)) {
    return 'cold'
  }
  return 'cold_anonymous'
}

interface TierConfig {
  primary_action: AutoAction
  secondary_actions: ReadonlyArray<AutoAction>
  message_intensity: MessageIntensity
  show_pricing_inline: boolean
  show_calculator_widget_default: boolean
  label: string
}

function configForTier(tier: VisitorTier, behavior: VisitorBehavior): TierConfig {
  switch (tier) {
    case 'hot': {
      const secondary: AutoAction[] = []
      // trigger_hot_lead_email uniquement si on a un email identifiable
      // (authenticated OU newsletter). Sinon focus visuel CTA principal.
      if (behavior.is_authenticated || behavior.has_signed_up_newsletter) {
        secondary.push('trigger_hot_lead_email')
      }
      secondary.push('slack_alert_benjamin')
      return {
        primary_action: 'show_trial_cta_primary',
        secondary_actions: secondary,
        message_intensity: 'prominent',
        show_pricing_inline: true,
        show_calculator_widget_default: true,
        label: 'Hot',
      }
    }
    case 'warm': {
      const secondary: AutoAction[] = []
      if (behavior.is_authenticated || behavior.has_signed_up_newsletter) {
        secondary.push('trigger_nurture_sequence')
      }
      return {
        primary_action: 'show_demo_cta',
        secondary_actions: secondary,
        message_intensity: 'normal',
        show_pricing_inline: true,
        show_calculator_widget_default: true,
        label: 'Warm',
      }
    }
    case 'cold':
      return {
        primary_action: 'show_learn_more',
        secondary_actions: ['capture_email_softly'],
        message_intensity: 'normal',
        show_pricing_inline: false,
        show_calculator_widget_default: true,
        label: 'Cold',
      }
    case 'cold_anonymous':
      return {
        primary_action: 'show_lead_magnet',
        secondary_actions: [],
        message_intensity: 'discreet',
        show_pricing_inline: false,
        show_calculator_widget_default: false,
        label: 'Cold anonymous',
      }
  }
}

function buildHumanMessage(tier: VisitorTier, score: number, behavior: VisitorBehavior): string {
  const tierLabel: Record<VisitorTier, string> = {
    hot: 'Hot',
    warm: 'Warm',
    cold: 'Cold',
    cold_anonymous: 'Cold anonymous',
  }
  return `${tierLabel[tier]} visitor (score ${score}) · source ${behavior.utm_source} · ${behavior.page_count} pages vues`
}

/**
 * Classifie un visiteur depuis son score + son comportement.
 *
 * @example
 * ```ts
 * const behavior = mergeBehaviorWithPageView(
 *   buildEmptyBehavior('sess_xyz'),
 *   '/tarifs',
 *   120,
 *   70,
 * )
 * const enriched = { ...behavior, has_started_signup_flow: true, utm_source: 'linkedin' }
 * const score_result = computeVisitorScore(enriched)
 * const classification = classifyVisitor(score_result, enriched)
 * // → { tier: 'hot', primary_action: 'show_trial_cta_primary', ... }
 * ```
 */
export function classifyVisitor(
  score_result: VisitorScoreResult,
  behavior: VisitorBehavior,
): VisitorClassification {
  const tier = determineTier(score_result.score, behavior)
  const config = configForTier(tier, behavior)

  // Le widget calculateur n'est PAS affiché si l'utilisateur a déjà
  // visité (ou complété) le calculateur — éviter la redondance UX.
  const show_calculator_widget =
    config.show_calculator_widget_default &&
    !behavior.has_visited_calculator &&
    !behavior.has_used_calculator_to_completion

  return {
    score: score_result.score,
    tier,
    primary_action: config.primary_action,
    secondary_actions: config.secondary_actions,
    message_intensity: config.message_intensity,
    show_pricing_inline: config.show_pricing_inline,
    show_calculator_widget,
    human_message: buildHumanMessage(tier, score_result.score, behavior),
  }
}
