/**
 * Configuration backend des 5 forfaits KOVAS V1 (refonte P9 — 2026-05-28).
 *
 * Modèle "all-you-can-eat" : prix fixe mensuel, missions ILLIMITÉES,
 * fair-use cap par tier. AUCUN usage-record metered pour les missions.
 *
 * Les Stripe Price IDs sont créés manuellement dans le dashboard Stripe
 * (ou via `scripts/stripe-provision-plans.ts`) et exposés par les variables
 * d'environnement `STRIPE_PRICE_<PLAN>_<CYCLE>`.
 *
 * Source de vérité côté DB : table `subscription_plans`. Ce fichier en est
 * le miroir typé côté Next.js.
 *
 * Compat ascendante : l'export `KOVAS_TIERS` est conservé sous forme d'alias
 * qui mappe les anciens IDs ('discovery' / 'standard' / 'volume') vers les
 * nouveaux plans, pour éviter de casser les consommateurs (admin dashboard,
 * /app/account, finance-calculator, etc.). Les anciens plans Stripe restent
 * actifs en backend pour les utilisateurs grandfathered.
 */

// ============================================
// Nouveau modèle — 5 plans V1 illimités
// ============================================

export type KovasPlanId =
  | 'essential'
  | 'decouverte'
  | 'pro'
  | 'all_inclusive'
  | 'cabinet'

export interface KovasPlan {
  id: KovasPlanId
  label: string
  description: string
  priceMonthlyCents: number
  priceAnnualCents: number // = 10 × monthly (2 mois offerts)
  storageGb: number
  usersIncluded: number
  extraUserPriceCents?: number
  maxUsers?: number
  /** Soft cap fair-use missions (visible UI). */
  fairUseMissionsSoftCap: number
  /** Hard cap mensuel Whisper en secondes (silencieux). */
  hardCapWhisperSeconds: number
  /** Hard cap mensuel Vision IA en appels (0 = non disponible). */
  hardCapVisionCalls: number
  /** Anti-abus : rafale max missions par jour. */
  hardCapBurstPerDay: number
  recommended?: boolean
  featured?: boolean
}

export const KOVAS_PLANS: readonly KovasPlan[] = [
  {
    id: 'essential',
    label: 'Essential',
    description: 'Démarrer en toute simplicité sur les 4 diagnostics socle',
    priceMonthlyCents: 900,
    priceAnnualCents: 9000,
    storageGb: 10,
    usersIncluded: 1,
    fairUseMissionsSoftCap: 50,
    hardCapWhisperSeconds: 5 * 3600,
    hardCapVisionCalls: 0,
    hardCapBurstPerDay: 10,
  },
  {
    id: 'decouverte',
    label: 'Découverte',
    description: 'Les 8 diagnostics standards avec IA Haiku structuration',
    priceMonthlyCents: 1900,
    priceAnnualCents: 19000,
    storageGb: 20,
    usersIncluded: 1,
    fairUseMissionsSoftCap: 100,
    hardCapWhisperSeconds: 15 * 3600,
    hardCapVisionCalls: 0,
    hardCapBurstPerDay: 20,
  },
  {
    id: 'pro',
    label: 'Pro',
    description: 'Le quotidien du diagnostiqueur indépendant',
    priceMonthlyCents: 3500,
    priceAnnualCents: 35000,
    storageGb: 50,
    usersIncluded: 1,
    fairUseMissionsSoftCap: 200,
    hardCapWhisperSeconds: 30 * 3600,
    hardCapVisionCalls: 200,
    hardCapBurstPerDay: 30,
    recommended: true,
    featured: true,
  },
  {
    id: 'all_inclusive',
    label: 'All Inclusive',
    description: 'Toute la puissance KOVAS, sans aucune limite à gérer',
    priceMonthlyCents: 4900,
    priceAnnualCents: 49000,
    storageGb: 100,
    usersIncluded: 1,
    fairUseMissionsSoftCap: 350,
    hardCapWhisperSeconds: 60 * 3600,
    hardCapVisionCalls: 500,
    hardCapBurstPerDay: 50,
  },
  {
    id: 'cabinet',
    label: 'Cabinet',
    description: 'Pour les équipes et les cabinets multi-diagnostiqueurs',
    priceMonthlyCents: 8900,
    priceAnnualCents: 89000,
    storageGb: 200,
    usersIncluded: 3,
    extraUserPriceCents: 1900,
    maxUsers: 10,
    fairUseMissionsSoftCap: 500,
    hardCapWhisperSeconds: 120 * 3600,
    hardCapVisionCalls: 1500,
    hardCapBurstPerDay: 80,
  },
]

export function getPlan(id: string): KovasPlan | undefined {
  return KOVAS_PLANS.find((p) => p.id === id)
}

/**
 * Map env Stripe Price IDs par plan × cycle.
 *
 * Pour les nouveaux plans : prix fixe mensuel (`recurring.interval: month`) ou
 * annuel (`recurring.interval: year`) — JAMAIS metered. Le surplus à l'usage
 * n'existe plus dans le modèle all-you-can-eat.
 *
 * Pour les plans grandfathered : leurs anciens prix Stripe (avec metered
 * line_items pour overage) restent actifs en backend mais ne sont PAS retournés
 * par cette fonction. Utiliser directement les colonnes Stripe de la table
 * `subscriptions` pour les abonnements legacy.
 */
export function getStripePriceId(
  planOrLegacyId: KovasPlanId | KovasTierLegacyId,
  cycle: 'monthly' | 'annual',
): string | null {
  const resolvedId: KovasPlanId =
    planOrLegacyId in LEGACY_TIER_TO_PLAN
      ? LEGACY_TIER_TO_PLAN[planOrLegacyId as KovasTierLegacyId]
      : (planOrLegacyId as KovasPlanId)
  const key = `STRIPE_PRICE_${resolvedId.toUpperCase()}_${cycle.toUpperCase()}`
  return process.env[key] ?? null
}

// ============================================
// Compat ascendante — KOVAS_TIERS / KovasTier / getTier
// ----------------------------------------------------
// Mapping rétrocompat pour les consommateurs historiques (admin dashboard,
// /app/account, finance-calculator, webhook Stripe).
//
// Mapping retenu :
//   ancien 'discovery' (29€, 20 missions)  → nouveau 'decouverte' (19€)
//   ancien 'standard'  (59€, 60 missions)  → nouveau 'pro'        (35€)
//   ancien 'volume'    (99€, 150 missions) → nouveau 'all_inclusive' (49€)
//
// Important : les abonnements grandfathered restent sur leur **ancien** prix
// Stripe (rétrocompat à vie). Cette table n'affecte que les **nouveaux**
// signups qui auraient l'ID legacy dans leur metadata Stripe (cas edge).
// ============================================

export type KovasTierLegacyId = 'discovery' | 'standard' | 'volume'

export interface KovasTier {
  id: KovasTierLegacyId
  label: string
  description: string
  priceMonthlyCents: number
  priceAnnualCents: number
  missionsIncluded: number
  overagePriceCents: number
  storageGb: number
  recommended?: boolean
}

/** Mapping ancien id → nouveau plan id. */
export const LEGACY_TIER_TO_PLAN: Record<KovasTierLegacyId, KovasPlanId> = {
  discovery: 'decouverte',
  standard: 'pro',
  volume: 'all_inclusive',
}

function planToLegacyTier(legacyId: KovasTierLegacyId): KovasTier {
  const plan = getPlan(LEGACY_TIER_TO_PLAN[legacyId])
  if (!plan) {
    throw new Error(
      `[stripe-config] Plan introuvable pour le legacy tier "${legacyId}" — mapping cassé.`,
    )
  }
  // Pour les abonnements grandfathered, le surplus reste défini en base. Ici
  // on expose 0 + 9999 missions "incluses" pour indiquer "missions illimitées
  // sous fair-use" aux consommateurs UI qui n'auraient pas migré.
  return {
    id: legacyId,
    label: plan.label,
    description: plan.description,
    priceMonthlyCents: plan.priceMonthlyCents,
    priceAnnualCents: plan.priceAnnualCents,
    missionsIncluded: 9999,
    overagePriceCents: 0,
    storageGb: plan.storageGb,
    recommended: plan.recommended,
  }
}

export const KOVAS_TIERS: KovasTier[] = [
  planToLegacyTier('discovery'),
  planToLegacyTier('standard'),
  planToLegacyTier('volume'),
]

export function getTier(id: string): KovasTier | undefined {
  return KOVAS_TIERS.find((t) => t.id === id)
}
