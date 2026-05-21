/**
 * Feature gating par forfait — source de vérité côté code (mirror de
 * `subscription_plans.features` JSONB en base).
 *
 * Utilisé par : dashboard sections conditionnelles, /app/* pages qui doivent
 * afficher ou masquer des features selon le plan actif.
 *
 * Convention : un user a accès à une feature soit via son plan_code (inclusion
 * directe), soit via un add-on actif (table `user_addons` status='active' ou
 * 'trialing'). Pour V1 simple, ce helper ne check que le plan_code direct.
 * Le check add-on viendra dans une seconde itération (helper async dédié).
 */

import type { KovasPlanId } from '@/lib/stripe-config'

export type FeatureKey =
  | 'cockpit_ademe_mode1'
  | 'cockpit_ademe_mode2'
  | 'shield_defense'
  | 'parameter_suggestions'
  | 'regulatory_chat'
  | 'regulatory_basic_notifs'
  | 'community_referentiel'
  | 'analytics_benchmark'
  | 'auto_quote_email'
  | 'followup_advanced'
  | 'prescribers'
  | 'opendata'
  | 'payment_lock'
  | 'pipeline_kanban'
  | 'devis_pro'
  | 'yousign'
  | 'factur_x'
  | 'pennylane_sync'
  | 'multi_user'

const PLAN_FEATURES: Record<KovasPlanId | 'essential' | 'decouverte' | 'pro' | 'all_inclusive' | 'cabinet', FeatureKey[]> = {
  essential: ['regulatory_basic_notifs'],
  decouverte: ['regulatory_basic_notifs', 'cockpit_ademe_mode1'],
  pro: [
    'regulatory_basic_notifs',
    'cockpit_ademe_mode1',
    'devis_pro',
    'yousign',
    'factur_x',
    'pennylane_sync',
    'prescribers',
    'opendata',
    'payment_lock',
    'pipeline_kanban',
  ],
  all_inclusive: [
    'regulatory_basic_notifs',
    'cockpit_ademe_mode1',
    'cockpit_ademe_mode2',
    'devis_pro',
    'yousign',
    'factur_x',
    'pennylane_sync',
    'prescribers',
    'opendata',
    'payment_lock',
    'pipeline_kanban',
    'shield_defense',
    'parameter_suggestions',
    'regulatory_chat',
    'community_referentiel',
    'analytics_benchmark',
    'auto_quote_email',
    'followup_advanced',
  ],
  cabinet: [
    'regulatory_basic_notifs',
    'cockpit_ademe_mode1',
    'cockpit_ademe_mode2',
    'devis_pro',
    'yousign',
    'factur_x',
    'pennylane_sync',
    'prescribers',
    'opendata',
    'payment_lock',
    'pipeline_kanban',
    'shield_defense',
    'parameter_suggestions',
    'regulatory_chat',
    'community_referentiel',
    'analytics_benchmark',
    'auto_quote_email',
    'followup_advanced',
    'multi_user',
  ],
}

/**
 * Renvoie `true` si le plan donné inclut la feature.
 * Pour les feature gating gated par add-on uniquement, utiliser
 * `userHasAddon(orgId, moduleCode)` séparément (helper async).
 */
export function planHasFeature(
  planCode: string | null | undefined,
  feature: FeatureKey,
): boolean {
  if (!planCode) return false
  const planFeatures = PLAN_FEATURES[planCode as keyof typeof PLAN_FEATURES]
  if (!planFeatures) return false
  return planFeatures.includes(feature)
}

/**
 * Tier hierarchy pour comparaisons `>=` (ex: "pro ou plus") :
 *   essential < decouverte < pro < all_inclusive < cabinet
 */
const PLAN_RANK: Record<string, number> = {
  essential: 1,
  decouverte: 2,
  pro: 3,
  all_inclusive: 4,
  cabinet: 5,
}

export function planRank(planCode: string | null | undefined): number {
  if (!planCode) return 0
  return PLAN_RANK[planCode] ?? 0
}

/** True si le plan utilisateur est au moins au niveau du plan minimum requis. */
export function planAtLeast(
  userPlan: string | null | undefined,
  minimumPlan: keyof typeof PLAN_RANK,
): boolean {
  return planRank(userPlan) >= planRank(minimumPlan)
}
