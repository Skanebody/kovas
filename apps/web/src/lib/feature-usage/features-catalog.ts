/**
 * KOVAS — Système 10 : Feature usage learner — catalog des features V1.
 *
 * Source : `docs/strategy/AI_AUTONOMY_V1.md` §13 (Feature usage learner) +
 * `CLAUDE.md` §3 (10 features V1) + features livrées branche refonte-2026-05.
 *
 * Registry statique des 12 features V1 KOVAS trackées en adoption hebdo. Chaque
 * feature expose son impact business, son taux d'adoption attendu sur 30j, le
 * minimum d'usages pour qu'un user soit considéré "active" sur la feature, et
 * le nom d'événement PostHog correspondant pour le pipeline d'ingestion.
 *
 * Pure data, zéro IO. Le caller (Edge Function cron hebdo) joint ce catalog
 * avec les stats PostHog data export pour produire les FeatureUsageStats.
 */

export type FeatureId =
  | 'voice_capture'
  | 'photo_geolocation'
  | 'cross_check_6_sources'
  | 'liciel_export'
  | 'devis'
  | 'factures'
  | 'annuaire'
  | 'parrainage'
  | 'analytics'
  | 'baseline_minutes'
  | 'integrations_pdp'
  | 'mission_chat'

export type FeatureCategory =
  | 'mission_workflow'
  | 'post_mission'
  | 'business_ops'
  | 'marketing'
  | 'analytics'

export type FeatureImpact = 'core' | 'high' | 'medium' | 'low'

export type FeatureTier = 'solo' | 'pro' | 'cabinet' | 'cabinet_plus'

export interface FeatureDefinition {
  /** Identifiant stable (utilisé en DB + clé PostHog) */
  id: FeatureId
  /** Catégorie pour grouper la décision produit */
  category: FeatureCategory
  /** Nom commercial affiché dans les rapports admin */
  display_name: string
  /** Description courte 1 ligne pour les rapports */
  description: string
  /** Impact business (drive la priorité de l'investigation si bucket=dead) */
  impact: FeatureImpact
  /** Adoption cible 0-100 (% users actifs qui devraient utiliser la feature sur 30j) */
  expected_adoption_pct: number
  /** Nombre d'usages /30j pour qu'un user soit "active" sur cette feature */
  min_usage_for_active: number
  /** Tier minimal Stripe qui débloque la feature */
  available_from_tier: FeatureTier
  /** Nom de l'événement PostHog correspondant (capture côté client) */
  posthog_event_name: string
}

/**
 * Catalogue canonique des 12 features V1 trackées en adoption.
 *
 * Source `CLAUDE.md` §3 (10 features MVP) étendu par les 2 features
 * livrées dans la branche refonte (`baseline_minutes`, `mission_chat`) et
 * les modules business ops (`devis`, `factures`, `integrations_pdp`).
 */
export const FEATURES_CATALOG: ReadonlyArray<FeatureDefinition> = [
  // ---------- Mission workflow (terrain) ----------
  {
    id: 'voice_capture',
    category: 'mission_workflow',
    display_name: 'Saisie vocale terrain',
    description: 'Dictée Whisper + parser custom + Claude Haiku (hybride 80/20).',
    impact: 'core',
    expected_adoption_pct: 80,
    min_usage_for_active: 3,
    available_from_tier: 'solo',
    posthog_event_name: 'feature_used_voice_capture',
  },
  {
    id: 'photo_geolocation',
    category: 'mission_workflow',
    display_name: 'Photos géolocalisées',
    description: 'Capture photo + GPS + annotations Konva (WebP compressé).',
    impact: 'core',
    expected_adoption_pct: 85,
    min_usage_for_active: 5,
    available_from_tier: 'solo',
    posthog_event_name: 'feature_used_photo_geolocation',
  },
  {
    id: 'cross_check_6_sources',
    category: 'mission_workflow',
    display_name: 'Cross-check 6 sources',
    description: 'Validation cohérence BAN + IGN + Géorisques + DVF + INSEE + ADEME.',
    impact: 'core',
    expected_adoption_pct: 70,
    min_usage_for_active: 5,
    available_from_tier: 'solo',
    posthog_event_name: 'feature_used_cross_check_6_sources',
  },
  {
    id: 'mission_chat',
    category: 'mission_workflow',
    display_name: 'Tchat mission IA',
    description: 'Mode mission Capture/Conversation avec Claude tool use + Vision.',
    impact: 'high',
    expected_adoption_pct: 55,
    min_usage_for_active: 2,
    available_from_tier: 'solo',
    posthog_event_name: 'feature_used_mission_chat',
  },
  // ---------- Post-mission (export) ----------
  {
    id: 'liciel_export',
    category: 'post_mission',
    display_name: 'Export Liciel ZIP',
    description: 'Export multi-format dont ZIP Liciel + XML CII passerelles.',
    impact: 'core',
    expected_adoption_pct: 75,
    min_usage_for_active: 2,
    available_from_tier: 'solo',
    posthog_event_name: 'feature_used_liciel_export',
  },
  // ---------- Business ops (devis, factures, intégrations) ----------
  {
    id: 'devis',
    category: 'business_ops',
    display_name: 'Devis',
    description: 'Génération devis Factur-X PPF-ready + relances.',
    impact: 'high',
    expected_adoption_pct: 60,
    min_usage_for_active: 2,
    available_from_tier: 'solo',
    posthog_event_name: 'feature_used_devis',
  },
  {
    id: 'factures',
    category: 'business_ops',
    display_name: 'Factures',
    description: 'Facturation séquentielle + Factur-X + cycle de relances.',
    impact: 'high',
    expected_adoption_pct: 65,
    min_usage_for_active: 2,
    available_from_tier: 'solo',
    posthog_event_name: 'feature_used_factures',
  },
  {
    id: 'integrations_pdp',
    category: 'business_ops',
    display_name: 'Intégrations PDP/PA',
    description: 'Sync Qonto + Pennylane + Indy + Tiime (early adopters PDP).',
    impact: 'low',
    expected_adoption_pct: 15,
    min_usage_for_active: 1,
    available_from_tier: 'pro',
    posthog_event_name: 'feature_used_integrations_pdp',
  },
  // ---------- Marketing (annuaire, parrainage) ----------
  {
    id: 'annuaire',
    category: 'marketing',
    display_name: 'Annuaire diagnostiqueurs',
    description: 'Fiche publique annuaire + reviews + stats benchmark zone.',
    impact: 'medium',
    expected_adoption_pct: 45,
    min_usage_for_active: 1,
    available_from_tier: 'solo',
    posthog_event_name: 'feature_used_annuaire',
  },
  {
    id: 'parrainage',
    category: 'marketing',
    display_name: 'Programme parrainage',
    description: 'Liens affiliés + 7 niveaux gamification + récompenses.',
    impact: 'medium',
    expected_adoption_pct: 25,
    min_usage_for_active: 1,
    available_from_tier: 'solo',
    posthog_event_name: 'feature_used_parrainage',
  },
  // ---------- Analytics (dashboard, KPI) ----------
  {
    id: 'analytics',
    category: 'analytics',
    display_name: 'Analytics cabinet',
    description: 'Page /dashboard/analytics style Apple Santé Tendances.',
    impact: 'medium',
    expected_adoption_pct: 30,
    min_usage_for_active: 1,
    available_from_tier: 'pro',
    posthog_event_name: 'feature_used_analytics',
  },
  {
    id: 'baseline_minutes',
    category: 'analytics',
    display_name: 'Baseline minutes/mission',
    description: 'Configuration baseline + Gain Tracker personnalisé.',
    impact: 'medium',
    expected_adoption_pct: 40,
    min_usage_for_active: 1,
    available_from_tier: 'solo',
    posthog_event_name: 'feature_used_baseline_minutes',
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ordre canonique des tiers pour les comparaisons "tier >= solo". */
const TIER_RANK: Record<FeatureTier, number> = {
  solo: 0,
  pro: 1,
  cabinet: 2,
  cabinet_plus: 3,
}

/**
 * Récupère une feature par son id.
 *
 * @example
 * ```ts
 * const f = getFeature('voice_capture')
 * // → { id: 'voice_capture', impact: 'core', expected_adoption_pct: 80, ... }
 * ```
 */
export function getFeature(id: FeatureId): FeatureDefinition | undefined {
  return FEATURES_CATALOG.find((f) => f.id === id)
}

/**
 * Liste les features d'une catégorie donnée.
 *
 * @example
 * ```ts
 * const ops = getFeaturesByCategory('business_ops')
 * // → [{ id: 'devis' }, { id: 'factures' }, { id: 'integrations_pdp' }]
 * ```
 */
export function getFeaturesByCategory(cat: FeatureCategory): FeatureDefinition[] {
  return FEATURES_CATALOG.filter((f) => f.category === cat)
}

/**
 * Liste les features disponibles pour un tier donné (tier user >= feature tier).
 *
 * Inclut toutes les features dont `available_from_tier` est inférieur ou égal
 * au tier passé. Utilisé par le promotion engine pour filtrer les candidates.
 *
 * @example
 * ```ts
 * const solo = getFeaturesByMinTier('solo')
 * // → toutes les features available_from_tier === 'solo'
 * const pro = getFeaturesByMinTier('pro')
 * // → solo + pro features (analytics, integrations_pdp inclus)
 * ```
 */
export function getFeaturesByMinTier(tier: FeatureTier): FeatureDefinition[] {
  const userRank = TIER_RANK[tier]
  return FEATURES_CATALOG.filter((f) => TIER_RANK[f.available_from_tier] <= userRank)
}

/** Compare deux tiers — utile pour les autres modules de feature-usage. */
export function tierGte(a: FeatureTier, b: FeatureTier): boolean {
  return TIER_RANK[a] >= TIER_RANK[b]
}
