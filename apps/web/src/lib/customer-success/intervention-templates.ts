/**
 * KOVAS — Système 11 (partie retention) : Intervention templates registry.
 *
 * Mapping `AutoAction` → template Brevo (subject variants + dynamic params).
 * Consommé par la future Edge Function `customer-success-dispatcher` qui
 * lira un `ActionPlan` (cf. action-decider.ts) et fera les appels API Brevo.
 *
 * Pour le bandit (Système 2), `subject_variants` amorce les challengers
 * initiaux — quand un challenger gagne, Claude Sonnet génère 5 nouveaux
 * variants comme dans email-bandit/prompts.ts.
 *
 * ⚠️ Phase 3 reminder : aucun template ne déclenche un chat IA conversationnel
 * (réservé Phase 3 M19+). Les réponses sont toujours pré-rédigées (humaines
 * pour critical, IA pré-validée par Benjamin pour les autres).
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §14 + §5 (subject bandit).
 * Avatar SOBRE PROFESSIONNEL — FR tutoiement, max 50 chars, zéro emoji.
 *
 * Déterministe, testable, zéro IO.
 */

import type { ActionPlan, AutoAction } from './action-decider'

export type InterventionTone = 'humain' | 'transactionnel' | 'pro_sober'

export interface InterventionTemplate {
  /** Hint pour matcher avec un template Brevo configuré côté admin */
  brevo_template_id_hint: string
  /** Subjects challengers initiaux pour le bandit Système 2 */
  subject_variants: ReadonlyArray<string>
  /** Synopsis du contenu pour génération Claude / brief copywriter */
  body_outline: string
  /** Params dynamiques attendus (à injecter via Brevo merge tags) */
  dynamic_params_required: ReadonlyArray<string>
  tone: InterventionTone
  /** Anti-spam : on ne renvoie pas ce template au même user avant N jours */
  cooldown_days: number
}

// ---------------------------------------------------------------------------
// Registry — 12 actions × 1 template par action
// ---------------------------------------------------------------------------

export const INTERVENTION_TEMPLATES: Record<AutoAction, InterventionTemplate> = {
  // -------------------------------------------------------------------------
  // Critical bucket — touche humaine Benjamin obligatoire
  // -------------------------------------------------------------------------
  send_founder_personal_email: {
    brevo_template_id_hint: 'tx-cs-founder-personal',
    subject_variants: [
      'Tout va bien {{firstname}} ?',
      'Un blocage sur KOVAS ?',
      '5 min de visio pour faire le point',
    ],
    body_outline:
      "Email perso signé Benjamin (fondateur). Ton humain, reconnaît qu'il a vu une baisse d'usage, pose une question ouverte, propose une visio 15 min sans engagement. Pas de pitch produit.",
    dynamic_params_required: ['firstname', 'tenure_months', 'last_mission_date'],
    tone: 'humain',
    cooldown_days: 30,
  },
  offer_call_15min: {
    brevo_template_id_hint: 'tx-cs-call-15min',
    subject_variants: [
      'On prend 15 min ?',
      'Je peux t’aider ce mardi',
      'Visio rapide cette semaine ?',
    ],
    body_outline:
      'Invitation Calendly visio 15 min avec Benjamin. Mentionne 2-3 sujets fréquents (export Liciel, vocal terrain, conformité). Bouton CTA unique vers /book-15min.',
    dynamic_params_required: ['firstname', 'calendly_url'],
    tone: 'humain',
    cooldown_days: 21,
  },
  pause_marketing_emails: {
    brevo_template_id_hint: 'tx-cs-pause-marketing',
    subject_variants: ['On met les emails en pause', 'Pause sur la communication'],
    body_outline:
      'Confirmation que les emails marketing sont mis en pause 30 jours. Rassure : les emails critiques (facturation, sécurité) restent actifs. Lien pour réactiver à tout moment.',
    dynamic_params_required: ['firstname', 'resume_url'],
    tone: 'transactionnel',
    cooldown_days: 90,
  },
  alert_benjamin_slack: {
    brevo_template_id_hint: 'internal-slack-cs-critical',
    subject_variants: [
      'CS critique : {{firstname}} ({{current_tier}})',
      'Alerte CS : {{firstname}} health < 40',
    ],
    body_outline:
      'Notification Slack interne (pas un email user). Inclut : nom user, tier, score, dimensions faibles, dernière action, lien admin /customer-success/[id].',
    dynamic_params_required: ['firstname', 'current_tier', 'health_score', 'admin_url'],
    tone: 'transactionnel',
    cooldown_days: 7,
  },

  // -------------------------------------------------------------------------
  // At risk bucket — emails informationnels / aide ciblée
  // -------------------------------------------------------------------------
  send_helpful_tip_email: {
    brevo_template_id_hint: 'tx-cs-helpful-tip',
    subject_variants: [
      '3 astuces pour gagner 20 min/mission',
      'Le truc que la majorité rate sur Liciel',
      'La fonction qui change le terrain',
    ],
    body_outline:
      'Email tip métier ciblé sur les features sous-utilisées du user (cf. Système 10 feature-usage-learner). 1 tip principal détaillé, 2 secondaires. Liens vers KB.',
    dynamic_params_required: ['firstname', 'underused_feature', 'kb_url'],
    tone: 'pro_sober',
    cooldown_days: 14,
  },
  offer_onboarding_help: {
    brevo_template_id_hint: 'tx-cs-onboarding-help',
    subject_variants: [
      'Coup de pouce sur ton essai ?',
      'Aide express pour démarrer KOVAS',
      'On démarre ensemble ?',
    ],
    body_outline:
      "Email user en essai dont l'engagement est faible. Propose : (1) tutoriel express 10 min, (2) visio onboarding 30 min, (3) chat support. Sans pression.",
    dynamic_params_required: ['firstname', 'trial_days_remaining', 'tutorial_url'],
    tone: 'humain',
    cooldown_days: 7,
  },
  suggest_underused_feature: {
    brevo_template_id_hint: 'tx-cs-feature-promo',
    subject_variants: [
      'Tu n’utilises pas encore la capture vocale ?',
      'Pré-vérification : 10 min gagnées',
      'Active le mode mission terrain',
    ],
    body_outline:
      "Mise en avant d'une feature V1 que le user n'a pas encore activée (cf. feature-usage-learner). Démo GIF/vidéo courte. CTA direct vers la feature in-app.",
    dynamic_params_required: ['firstname', 'feature_name', 'feature_url'],
    tone: 'pro_sober',
    cooldown_days: 21,
  },

  // -------------------------------------------------------------------------
  // Healthy bucket — expansion douce / récap
  // -------------------------------------------------------------------------
  suggest_addon: {
    brevo_template_id_hint: 'tx-cs-addon-suggestion',
    subject_variants: [
      'Tu pourrais débloquer plus de leads',
      'Un addon qui colle à ton activité',
      'Booste ton ROI KOVAS',
    ],
    body_outline:
      'Suggestion addon (pipeline MPR, premium reports, etc.) basée sur le pattern d’usage (cf. upsell-engine). 1 addon principal mis en avant + 1 alternatif. Pricing transparent.',
    dynamic_params_required: ['firstname', 'addon_key', 'addon_price', 'expected_roi'],
    tone: 'pro_sober',
    cooldown_days: 45,
  },
  send_monthly_recap_email: {
    brevo_template_id_hint: 'tx-cs-monthly-recap',
    subject_variants: [
      'Ton mois en chiffres KOVAS',
      'Ton récap d’activité',
      'Le bilan de ton mois',
    ],
    body_outline:
      'Récap mensuel sobre : missions réalisées, temps économisé estimé (Gain Tracker), DPE F/G détectés, nouveaux clients. Statut Pro débloqué le cas échéant. Format rapport business.',
    dynamic_params_required: ['firstname', 'missions_this_month', 'hours_saved', 'fg_dpe_count'],
    tone: 'pro_sober',
    cooldown_days: 28,
  },

  // -------------------------------------------------------------------------
  // Promoter bucket — activation viralité
  // -------------------------------------------------------------------------
  request_review: {
    brevo_template_id_hint: 'tx-cs-review-request',
    subject_variants: [
      '5 min pour un avis ?',
      'Ton retour aide la communauté',
      '2 lignes sur ton expérience ?',
    ],
    body_outline:
      'Demande de review publique (Trustpilot, G2, ou témoignage site). Mentionne pourquoi (visibilité confrères, amélioration produit). Lien direct vers la plateforme de review.',
    dynamic_params_required: ['firstname', 'review_url'],
    tone: 'pro_sober',
    cooldown_days: 180,
  },
  request_referral: {
    brevo_template_id_hint: 'tx-cs-referral-invite',
    subject_variants: [
      'Tu connais un collègue diagnostiqueur ?',
      '1 mois offert pour chaque diag parrainé',
      'Active ton parrainage KOVAS',
    ],
    body_outline:
      'Activation du programme parrainage 7 niveaux (task #150). Rappelle gain mutuel (1 mois offert chaque côté), lien unique de parrainage, statut actuel dans la gamification.',
    dynamic_params_required: ['firstname', 'referral_link', 'referral_tier', 'referral_count'],
    tone: 'pro_sober',
    cooldown_days: 60,
  },
  invite_to_case_study: {
    brevo_template_id_hint: 'tx-cs-case-study',
    subject_variants: [
      'Ton parcours intéresse les confrères',
      'Un échange pour un case study ?',
      'On raconte ton histoire ?',
    ],
    body_outline:
      'Invitation à participer à un case study (interview 45 min + publication). Mentionne contrepartie (1 mois offert + mise en avant fiche annuaire Premium gratuite 3 mois).',
    dynamic_params_required: ['firstname', 'interview_url'],
    tone: 'humain',
    cooldown_days: 365,
  },
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

export function getInterventionTemplate(action: AutoAction): InterventionTemplate | undefined {
  return INTERVENTION_TEMPLATES[action]
}

export interface UserInterventionData {
  firstname: string
  tenure_months: number
  missions_total: number
  current_tier: string
}

export interface PreparedIntervention {
  action: AutoAction
  template: InterventionTemplate
  dynamic_params: Record<string, string | number>
}

export interface InterventionPlan {
  primary: PreparedIntervention | null
  secondary: ReadonlyArray<PreparedIntervention>
}

/**
 * Construit les params dynamiques de base depuis user_data + ActionPlan.
 * Les valeurs manquantes (calendly_url, addon_key, etc.) sont laissées vides
 * pour que l'Edge Function les complète au moment de l'envoi.
 */
function buildDynamicParams(
  user_data: UserInterventionData,
  template: InterventionTemplate,
): Record<string, string | number> {
  const params: Record<string, string | number> = {}

  for (const key of template.dynamic_params_required) {
    switch (key) {
      case 'firstname':
        params.firstname = user_data.firstname
        break
      case 'tenure_months':
        params.tenure_months = user_data.tenure_months
        break
      case 'current_tier':
        params.current_tier = user_data.current_tier
        break
      case 'missions_this_month':
      case 'missions_total':
        params[key] = user_data.missions_total
        break
      default:
        // Placeholders à compléter par l'Edge Function au moment de l'envoi.
        params[key] = ''
        break
    }
  }

  return params
}

/**
 * Construit un plan d'intervention prêt à envoyer à Brevo depuis un ActionPlan.
 *
 * @example
 * ```ts
 * const plan = decideActions(health, context)
 * const intervention = buildInterventionPlan(plan, {
 *   firstname: 'Benjamin',
 *   tenure_months: 6,
 *   missions_total: 142,
 *   current_tier: 'pro',
 * })
 * // intervention.primary.template.subject_variants → bandit choisit le subject
 * ```
 */
export function buildInterventionPlan(
  plan: ActionPlan,
  user_data: UserInterventionData,
): InterventionPlan {
  const primaryTemplate = getInterventionTemplate(plan.primary_action)
  const primary: PreparedIntervention | null = primaryTemplate
    ? {
        action: plan.primary_action,
        template: primaryTemplate,
        dynamic_params: buildDynamicParams(user_data, primaryTemplate),
      }
    : null

  const secondary: PreparedIntervention[] = []
  for (const action of plan.secondary_actions) {
    const template = getInterventionTemplate(action)
    if (template) {
      secondary.push({
        action,
        template,
        dynamic_params: buildDynamicParams(user_data, template),
      })
    }
  }

  return { primary, secondary }
}
