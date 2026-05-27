/**
 * KOVAS — Algo 24 : Personalization engine.
 *
 * Pure function qui retourne une configuration UI personnalisée par user :
 *   - Widgets dashboard prioritaires (ordre, visibilité)
 *   - Features à suggérer (sous-utilisées + à fort impact)
 *   - Offres d'expansion pertinentes (selon cluster + santé)
 *   - Contenu recommandé (KB articles, guides)
 *   - Fréquence de notifications optimale (selon health)
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` (Algo 24).
 *
 * Stratégie :
 *   - Cluster comportemental (A1.3.13) détermine le « profil base »
 *   - Health score (cf. système 11) ajuste l'intensité (notif freq, etc.)
 *   - Feature usage learner (système 10) flag les features sous-utilisées
 *
 * Déterministe, testable, zéro IO. Le caller assemble les inputs depuis
 * `diagnostician_clusters` + `health_scores` + `feature_usage` matview.
 */

export type ClusterId = 'power_user' | 'cabinet_team' | 'occasional_solo' | 'new_user' | 'churning'

export type HealthBucket = 'critical' | 'at_risk' | 'healthy' | 'promoter'

export type NotificationFrequency = 'minimal' | 'normal' | 'reduced' | 'paused'

export type DashboardWidgetId =
  | 'today_actions'
  | 'mission_pipeline'
  | 'cross_check_panel'
  | 'gain_tracker'
  | 'annuaire_stats'
  | 'leads_inbox'
  | 'analytics_summary'
  | 'team_activity'
  | 'onboarding_progress'
  | 'recent_clients'
  | 'invoices_due'
  | 'parrainage_card'

export type FeatureKey =
  | 'voice_capture'
  | 'cross_check_6_sources'
  | 'photo_geolocation'
  | 'liciel_export'
  | 'devis_module'
  | 'factures_module'
  | 'annuaire_fiche'
  | 'parrainage'
  | 'analytics_dashboard'
  | 'baseline_minutes'
  | 'integrations_pdp'

export type ContentTopic =
  | 'getting_started'
  | 'mission_workflow'
  | 'liciel_integration'
  | 'ademe_compliance'
  | 'cabinet_setup'
  | 'annuaire_seo'
  | 'pricing_strategy'
  | 'tax_facture_x'

export interface PersonalizationInput {
  /** Cluster comportemental (A1.3.13) */
  cluster: ClusterId
  /** Health score 0-100 (système 11) */
  health_score: number
  /** Features peu utilisées pour ce user (système 10) */
  underused_features: ReadonlyArray<FeatureKey>
  /** Tenure en mois */
  tenure_months: number
  /** A complété onboarding */
  onboarding_completed: boolean
  /** Tier abonnement */
  tier: 'solo' | 'pro' | 'cabinet' | 'cabinet_plus' | 'enterprise'
  /** A activé l'annuaire (claim ou abonnement) */
  has_annuaire: boolean
  /** A facturé ce mois-ci */
  invoiced_this_month: boolean
}

export interface PersonalizationResult {
  /** Ordre prioritaire des widgets dashboard (top-down) */
  dashboard_widgets: ReadonlyArray<DashboardWidgetId>
  /** Features à suggérer en priorité (max 3) */
  suggested_features: ReadonlyArray<FeatureKey>
  /** Topics de contenu recommandés (max 4) */
  content_recommendations: ReadonlyArray<ContentTopic>
  /** Fréquence notifications recommandée */
  notification_frequency: NotificationFrequency
  /** Bucket santé dérivé */
  health_bucket: HealthBucket
  /** Phrase humaine pour debug/admin UI */
  human_message: string
}

function healthBucketFromScore(score: number): HealthBucket {
  if (score >= 80) return 'promoter'
  if (score >= 60) return 'healthy'
  if (score >= 40) return 'at_risk'
  return 'critical'
}

function notificationFreqFor(bucket: HealthBucket): NotificationFrequency {
  switch (bucket) {
    case 'critical':
      return 'minimal' // Ne pas spammer un user en train de churner
    case 'at_risk':
      return 'reduced'
    case 'healthy':
      return 'normal'
    case 'promoter':
      return 'normal' // Pas plus, on respecte le user
  }
}

/**
 * Widgets dashboard prioritaires par cluster.
 *
 * Note : ordre = priorité top-down. Les widgets non listés ici sont disponibles
 * dans le customizer sidebar mais pas affichés par défaut.
 */
function widgetsForCluster(cluster: ClusterId, input: PersonalizationInput): DashboardWidgetId[] {
  const base: DashboardWidgetId[] = []

  // Onboarding widget reste visible jusqu'à completion
  if (!input.onboarding_completed) {
    base.push('onboarding_progress')
  }

  switch (cluster) {
    case 'power_user':
      // 30-50 missions/mois — focus production + revenue
      base.push(
        'today_actions',
        'mission_pipeline',
        'cross_check_panel',
        'gain_tracker',
        'invoices_due',
        'recent_clients',
      )
      break

    case 'cabinet_team':
      // 100+ missions/mois, 2-5 users — focus équipe + analytics
      base.push(
        'today_actions',
        'team_activity',
        'mission_pipeline',
        'analytics_summary',
        'invoices_due',
        'cross_check_panel',
      )
      break

    case 'occasional_solo':
      // <20 missions/mois — focus simplicité + gain de temps
      base.push('today_actions', 'gain_tracker', 'mission_pipeline', 'recent_clients')
      break

    case 'new_user':
      // M0-M1 — focus activation + KB
      base.push('today_actions', 'mission_pipeline', 'recent_clients')
      break

    case 'churning':
      // Signaux de désengagement — afficher uniquement l'essentiel + parrainage (retention)
      base.push('today_actions', 'mission_pipeline')
      break
  }

  // Annuaire widget si user a payé pour
  if (input.has_annuaire) {
    base.push('annuaire_stats', 'leads_inbox')
  }

  // Parrainage si user healthy
  if (input.tenure_months >= 1 && input.health_score >= 60) {
    base.push('parrainage_card')
  }

  return base
}

/**
 * Features suggérées : prendre la liste underused_features et filtrer
 * selon pertinence pour le cluster, max 3 retours.
 */
function suggestedFeaturesFor(
  underused: ReadonlyArray<FeatureKey>,
  cluster: ClusterId,
  input: PersonalizationInput,
): FeatureKey[] {
  // Priorité features par cluster (poids 0-10)
  const priority: Record<ClusterId, Partial<Record<FeatureKey, number>>> = {
    power_user: {
      voice_capture: 10,
      cross_check_6_sources: 10,
      liciel_export: 9,
      analytics_dashboard: 8,
      devis_module: 7,
      factures_module: 7,
      integrations_pdp: 6,
    },
    cabinet_team: {
      analytics_dashboard: 10,
      devis_module: 9,
      factures_module: 9,
      integrations_pdp: 8,
      cross_check_6_sources: 8,
      liciel_export: 7,
    },
    occasional_solo: {
      voice_capture: 10,
      photo_geolocation: 9,
      cross_check_6_sources: 8,
      liciel_export: 7,
      baseline_minutes: 6,
    },
    new_user: {
      voice_capture: 10,
      photo_geolocation: 10,
      liciel_export: 9,
      cross_check_6_sources: 8,
    },
    churning: {
      // Ré-engagement features : montrer le ROI
      voice_capture: 10,
      cross_check_6_sources: 9,
      baseline_minutes: 8,
    },
  }

  const clusterPriority = priority[cluster]

  // Filter underused features that have priority for this cluster
  const ranked = underused
    .filter((f) => clusterPriority[f] !== undefined)
    .sort((a, b) => (clusterPriority[b] ?? 0) - (clusterPriority[a] ?? 0))

  // Annuaire si pas activé et tier >= pro
  if (
    !input.has_annuaire &&
    (input.tier === 'pro' ||
      input.tier === 'cabinet' ||
      input.tier === 'cabinet_plus' ||
      input.tier === 'enterprise')
  ) {
    ranked.unshift('annuaire_fiche')
  }

  return ranked.slice(0, 3)
}

function contentRecommendationsFor(
  cluster: ClusterId,
  input: PersonalizationInput,
): ContentTopic[] {
  if (!input.onboarding_completed) {
    return ['getting_started', 'mission_workflow', 'liciel_integration', 'ademe_compliance']
  }

  switch (cluster) {
    case 'power_user':
      return ['ademe_compliance', 'liciel_integration', 'tax_facture_x', 'pricing_strategy']
    case 'cabinet_team':
      return ['cabinet_setup', 'tax_facture_x', 'ademe_compliance', 'pricing_strategy']
    case 'occasional_solo':
      return ['mission_workflow', 'liciel_integration', 'annuaire_seo']
    case 'new_user':
      return ['getting_started', 'mission_workflow', 'liciel_integration']
    case 'churning':
      // Ne pas overwhelmer un user qui décroche, juste 2 sujets essentiels
      return ['mission_workflow', 'ademe_compliance']
  }
}

function humanMessageFor(cluster: ClusterId, bucket: HealthBucket, widgetsCount: number): string {
  const clusterLabels: Record<ClusterId, string> = {
    power_user: 'Power user',
    cabinet_team: 'Cabinet équipe',
    occasional_solo: 'Solo occasionnel',
    new_user: 'Nouveau user',
    churning: 'Risque churn',
  }
  const bucketLabels: Record<HealthBucket, string> = {
    promoter: 'promoter',
    healthy: 'healthy',
    at_risk: 'at risk',
    critical: 'critical',
  }
  return `${clusterLabels[cluster]} · ${bucketLabels[bucket]} · ${widgetsCount} widgets actifs`
}

/**
 * Algorithme principal — personnalise l'expérience pour un user.
 *
 * @example
 * ```ts
 * const result = personalizeExperience({
 *   cluster: 'power_user',
 *   health_score: 78,
 *   underused_features: ['analytics_dashboard', 'parrainage'],
 *   tenure_months: 8,
 *   onboarding_completed: true,
 *   tier: 'pro',
 *   has_annuaire: true,
 *   invoiced_this_month: true,
 * })
 * // → widgets prioritaires : today, mission_pipeline, cross_check, gain_tracker, ...
 * //   features suggérées : analytics_dashboard
 * //   notifs : normal
 * ```
 */
export function personalizeExperience(input: PersonalizationInput): PersonalizationResult {
  const health_bucket = healthBucketFromScore(input.health_score)
  const dashboard_widgets = widgetsForCluster(input.cluster, input)
  const suggested_features = suggestedFeaturesFor(input.underused_features, input.cluster, input)
  const content_recommendations = contentRecommendationsFor(input.cluster, input)
  const notification_frequency = notificationFreqFor(health_bucket)
  const human_message = humanMessageFor(input.cluster, health_bucket, dashboard_widgets.length)

  return {
    dashboard_widgets,
    suggested_features,
    content_recommendations,
    notification_frequency,
    health_bucket,
    human_message,
  }
}
