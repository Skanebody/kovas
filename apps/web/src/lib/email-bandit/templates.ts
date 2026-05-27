/**
 * KOVAS — Système 2 : Email subject auto-optimization — Templates registry.
 *
 * Registre déclaratif des 15 templates emails KOVAS pilotés par le multi-armed
 * bandit. Chaque template porte ses propres subjects challengers initiaux, sa
 * catégorie, son KPI primaire, et sa fenêtre de cooldown anti-spam.
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §5 (Email subject auto-optimization).
 *
 * Stratégie de copy (subjects initiaux) :
 *   - FR strict, tutoiement systématique (avatar SOBRE PROFESSIONNEL).
 *   - Méthode Tugan Bara : specificity, loss aversion, curiosity gap,
 *     contraste, language match.
 *   - Aucun emoji, max 50 caractères (sweet spot Brevo + smartphone preview).
 *   - 3 à 5 variants par template pour amorcer le bandit dès J0.
 *
 * Le bandit choisit le subject à envoyer via Thompson sampling (variant-selector).
 * Quand un challenger gagne, Claude Sonnet génère 5 nouveaux variants
 * (cf. prompts.ts) qui rentrent en lice avec successes/trials = 0.
 *
 * Déterministe, testable, zéro IO.
 */

export type EmailTemplateId =
  | 'trial_day_1_tutorial'
  | 'trial_day_4_check_in'
  | 'trial_day_8_tips'
  | 'trial_day_27_will_end'
  | 'trial_day_30_converted'
  | 'retention_high_risk'
  | 'retention_medium_risk'
  | 'upsell_tier_upgrade'
  | 'upsell_addon_pipeline_mpr'
  | 'upsell_addon_premium_reports'
  | 'feature_promo_voice_capture'
  | 'feature_promo_cross_check'
  | 'review_request'
  | 'referral_invitation'
  | 'reactivation_winback'

export type EmailCategory = 'transactional' | 'lifecycle' | 'retention' | 'expansion' | 'engagement'

export interface EmailTemplate {
  id: EmailTemplateId
  category: EmailCategory
  description: string
  /** 3 à 5 subjects challengers initiaux, max 50 chars chacun, FR tutoiement */
  default_subject_variants: ReadonlyArray<string>
  /** Description courte de l'audience (admin UI + prompts Claude) */
  target_audience: string
  /** KPI principal optimisé par le bandit pour ce template */
  primary_kpi: 'open_rate' | 'click_rate' | 'conversion_rate'
  /** Anti-spam : on ne renvoie pas ce template au même user avant N jours */
  cooldown_days: number
}

// ---------------------------------------------------------------------------
// Registry — 15 templates couvrant lifecycle, retention, expansion, engagement
// ---------------------------------------------------------------------------

export const EMAIL_TEMPLATES: ReadonlyArray<EmailTemplate> = [
  // -------------------------------------------------------------------------
  // Lifecycle — séquence essai 30 jours
  // -------------------------------------------------------------------------
  {
    id: 'trial_day_1_tutorial',
    category: 'lifecycle',
    description: 'J+1 essai : tutoriel mission KOVAS en 10 min.',
    default_subject_variants: [
      'Ta première mission KOVAS en 10 min',
      'Capture vocale : essaie sur ta visite',
      'Le pas-à-pas mission complet',
      'Ton premier DPE en moins de 10 min',
      'Démarre fort : guide express terrain',
    ],
    target_audience: "Diagnostiqueurs en essai J+1, n'ont pas encore créé de mission.",
    primary_kpi: 'click_rate',
    cooldown_days: 30,
  },
  {
    id: 'trial_day_4_check_in',
    category: 'lifecycle',
    description: 'J+4 essai : check humain personnel de Benjamin (fondateur).',
    default_subject_variants: [
      'Tout se passe comme prévu ?',
      'Un blocage sur KOVAS ?',
      'Question rapide sur ton essai',
      'On fait le point en 2 min ?',
    ],
    target_audience: 'Diagnostiqueurs en essai J+4 — toucher humain Benjamin.',
    primary_kpi: 'click_rate',
    cooldown_days: 30,
  },
  {
    id: 'trial_day_8_tips',
    category: 'lifecycle',
    description: 'J+8 essai : tips diagnostic mobile + raccourcis vocaux.',
    default_subject_variants: [
      'Comment se déroule ton essai ?',
      '3 raccourcis qui gagnent 30 min',
      'Tips terrain pour tes prochaines visites',
      'Les 5 commandes vocales à retenir',
      'Tu utilises bien la saisie vocale ?',
    ],
    target_audience: 'Diagnostiqueurs en essai J+8 ayant créé au moins 1 mission.',
    primary_kpi: 'click_rate',
    cooldown_days: 30,
  },
  {
    id: 'trial_day_27_will_end',
    category: 'lifecycle',
    description: 'J+27 : essai termine dans 3 jours + débit annoncé.',
    default_subject_variants: [
      'Ton essai termine dans 3 jours',
      'On débite ta carte le 30',
      'Encore 3 jours pour tester KOVAS',
      'Préparation du prélèvement automatique',
      'Plus que 3 jours sur ton essai',
    ],
    target_audience: 'Diagnostiqueurs J+27 — webhook Stripe trial_will_end.',
    primary_kpi: 'conversion_rate',
    cooldown_days: 60,
  },
  {
    id: 'trial_day_30_converted',
    category: 'transactional',
    description: 'J+30 : confirmation conversion essai → payant.',
    default_subject_variants: [
      'Bienvenue sur KOVAS',
      'Ton abonnement est actif',
      'Confirmation : tu es passé en payant',
      'Facture du mois disponible',
    ],
    target_audience: 'Diagnostiqueurs qui viennent de basculer en payant.',
    primary_kpi: 'open_rate',
    cooldown_days: 365,
  },

  // -------------------------------------------------------------------------
  // Retention — health score dégradé
  // -------------------------------------------------------------------------
  {
    id: 'retention_high_risk',
    category: 'retention',
    description: 'Health score < 40 : risque churn critique, contact humain Benjamin.',
    default_subject_variants: [
      'Tout va bien ?',
      'Un blocage sur KOVAS ?',
      '5 min de visio pour faire le point',
      'On peut t aider sur quelque chose ?',
      'Une question avant que tu partes ?',
    ],
    target_audience: 'Abonnés actifs avec health score < 40 (signal churn fort).',
    primary_kpi: 'click_rate',
    cooldown_days: 14,
  },
  {
    id: 'retention_medium_risk',
    category: 'retention',
    description: 'Health score 40-60 : usage faible, réengagement soft.',
    default_subject_variants: [
      'Tu n as pas utilisé KOVAS cette semaine',
      'On a ajouté 3 features pour toi',
      'Reviens voir ce qui a changé',
      'Tu as essayé la nouvelle capture vocale ?',
      'Une dernière mission avant le mois prochain ?',
    ],
    target_audience: 'Abonnés actifs avec health score 40-60 (usage en baisse).',
    primary_kpi: 'click_rate',
    cooldown_days: 21,
  },

  // -------------------------------------------------------------------------
  // Expansion — upsell tier + addons
  // -------------------------------------------------------------------------
  {
    id: 'upsell_tier_upgrade',
    category: 'expansion',
    description: 'Quota >= 80% : suggestion upgrade tier économique.',
    default_subject_variants: [
      'Tu es à 87% de ton quota',
      'Pro débloque 100 missions / mois',
      'Ton quota mensuel touche au plafond',
      'Tu paies trop : passe sur Pro',
      'Économise 50 euros par mois',
    ],
    target_audience: 'Abonnés Solo avec quota >= 80% sur 2 mois consécutifs.',
    primary_kpi: 'conversion_rate',
    cooldown_days: 30,
  },
  {
    id: 'upsell_addon_pipeline_mpr',
    category: 'expansion',
    description: 'DPE F/G détectés : suggestion addon pipeline MaPrimeRénov.',
    default_subject_variants: [
      'Tu as 12 DPE F ou G ce mois',
      'Pipeline MaPrimeRénov : 240 euros / dossier',
      'Tes étiquettes F/G valent de l or',
      'Active la sortie automatique vers MAR',
      'Tes passoires énergétiques en cash-flow',
    ],
    target_audience: 'Diagnostiqueurs avec 5+ DPE F/G générés ce mois.',
    primary_kpi: 'conversion_rate',
    cooldown_days: 45,
  },
  {
    id: 'upsell_addon_premium_reports',
    category: 'expansion',
    description: '10+ missions / mois : suggestion addon rapports premium.',
    default_subject_variants: [
      'Tes rapports peuvent être plus pros',
      'Active le mode rapport premium',
      'Tes clients méritent un meilleur PDF',
      'Différencie-toi en 2 clics',
    ],
    target_audience: 'Diagnostiqueurs actifs avec 10+ missions / mois.',
    primary_kpi: 'conversion_rate',
    cooldown_days: 45,
  },

  // -------------------------------------------------------------------------
  // Engagement — feature promotion + reviews + referral
  // -------------------------------------------------------------------------
  {
    id: 'feature_promo_voice_capture',
    category: 'engagement',
    description: 'Saisie vocale sous-utilisée : promo + tuto 2 min.',
    default_subject_variants: [
      'Tu n utilises pas encore la saisie vocale',
      'Gagne 30 min par mission avec la voix',
      '2 min pour tester la saisie vocale',
      'Tes mains restent dans la prise élec',
      'La feature signature KOVAS en 2 min',
    ],
    target_audience: 'Diagnostiqueurs actifs M2+ sans usage voice_capture.',
    primary_kpi: 'click_rate',
    cooldown_days: 60,
  },
  {
    id: 'feature_promo_cross_check',
    category: 'engagement',
    description: 'Cross-check sous-utilisé : promo validation cohérence.',
    default_subject_variants: [
      'Évite 1 retour terrain par mois',
      'Active le cross-check sur tes diagnostics',
      'Tes incohérences avant export',
      'Le filet de sécurité pré-envoi',
    ],
    target_audience: 'Diagnostiqueurs actifs M2+ sans usage cross_check.',
    primary_kpi: 'click_rate',
    cooldown_days: 60,
  },
  {
    id: 'review_request',
    category: 'engagement',
    description: "Post-conversion D60 : demande d'avis Trustpilot / Capterra.",
    default_subject_variants: [
      '2 min pour aider KOVAS ?',
      'Ton avis compte vraiment',
      'Une note rapide sur Trustpilot ?',
      'Ton retour fait grandir KOVAS',
    ],
    target_audience: 'Abonnés payants depuis 60+ jours avec health score >= 70.',
    primary_kpi: 'click_rate',
    cooldown_days: 180,
  },
  {
    id: 'referral_invitation',
    category: 'engagement',
    description: 'Invitation parrainage : 1 mois offert par filleul converti.',
    default_subject_variants: [
      '1 mois offert par filleul',
      'Tu connais un autre diagnostiqueur ?',
      'Parraine et économise 79 euros',
      'Active ton lien de parrainage',
      'Ton réseau peut te payer KOVAS',
    ],
    target_audience: 'Abonnés payants depuis 90+ jours avec health score >= 70.',
    primary_kpi: 'click_rate',
    cooldown_days: 90,
  },

  // -------------------------------------------------------------------------
  // Reactivation — winback churned < 90j
  // -------------------------------------------------------------------------
  {
    id: 'reactivation_winback',
    category: 'lifecycle',
    description: 'User churné depuis < 90j : winback avec offre spéciale.',
    default_subject_variants: [
      'Reviens : 50% sur 3 mois',
      'On a corrigé ce qui te bloquait',
      'KOVAS a changé depuis ton départ',
      'Une seconde chance, à moitié prix',
      '3 mois à 14,50 euros pour revenir',
    ],
    target_audience: 'Anciens abonnés résiliés depuis moins de 90 jours.',
    primary_kpi: 'conversion_rate',
    cooldown_days: 90,
  },
] as const

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

const TEMPLATE_BY_ID = new Map<EmailTemplateId, EmailTemplate>(
  EMAIL_TEMPLATES.map((t) => [t.id, t]),
)

/**
 * Récupère un template par son id (undefined si inconnu).
 */
export function getEmailTemplate(id: EmailTemplateId): EmailTemplate | undefined {
  return TEMPLATE_BY_ID.get(id)
}

/**
 * Filtre les templates par catégorie.
 */
export function getTemplatesByCategory(cat: EmailCategory): EmailTemplate[] {
  return EMAIL_TEMPLATES.filter((t) => t.category === cat)
}
