/**
 * Configuration backend des forfaits KOVAS V4 — grille officielle 2026-05-22.
 *
 * Conserve l'API publique `KovasPlanId` / `KOVAS_PLANS` / `getPlan` / `KOVAS_TIERS`
 * pour ne pas casser les consommateurs historiques (admin dashboard, /app/account,
 * finance-calculator, webhook Stripe, etc.).
 *
 * Les noms officiels publics sont désormais Solo Light / Solo Pro / Cabinet /
 * Cabinet+ (cf. `lib/pricing-plans.ts`). Ce fichier ne contient que les IDs
 * legacy E2c (essential / decouverte / pro / all_inclusive / cabinet) car les
 * abonnements DB de phase E2c portent encore ces tier IDs ; le mapping vers la
 * nouvelle grille est géré par `LEGACY_PLAN_MAP` exporté depuis `pricing-plans.ts`.
 *
 * Les prix sont alignés sur la grille officielle (29 / 59 / 149 / 299 €) pour
 * que les futurs writes Stripe utilisent les bons montants.
 *
 * Source de vérité côté DB : table `subscription_plans`.
 * Source de vérité produit : `lib/pricing-plans.ts` + CLAUDE.md §4.
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

/**
 * Prix annuels = engagement annuel -15% sur 12× le prix mensuel (cf. CLAUDE.md §4).
 * Round() pour rester en integer centimes — pas de float ni string.
 */
function annualCentsWithDiscount(monthlyCents: number): number {
  return Math.round(monthlyCents * 12 * 0.85)
}

export const KOVAS_PLANS: readonly KovasPlan[] = [
  {
    // Tier `essential` legacy E2c — remappé vers Solo Light 29€ (grille officielle V4).
    id: 'essential',
    label: 'Solo Light',
    description: 'Démarrer en solo sur les diagnostics standards',
    priceMonthlyCents: 2900,
    priceAnnualCents: annualCentsWithDiscount(2900),
    storageGb: 12,
    usersIncluded: 1,
    fairUseMissionsSoftCap: 60,
    hardCapWhisperSeconds: 5 * 3600,
    hardCapVisionCalls: 0,
    hardCapBurstPerDay: 15,
  },
  {
    // Tier `decouverte` legacy E2c — équivalent Solo Light (alias historique).
    id: 'decouverte',
    label: 'Solo Light',
    description: 'Tier d’entrée pour valider le gain de temps — alias historique',
    priceMonthlyCents: 2900,
    priceAnnualCents: annualCentsWithDiscount(2900),
    storageGb: 12,
    usersIncluded: 1,
    fairUseMissionsSoftCap: 60,
    hardCapWhisperSeconds: 5 * 3600,
    hardCapVisionCalls: 0,
    hardCapBurstPerDay: 15,
  },
  {
    // Tier `pro` legacy E2c — remappé vers Solo Pro 59€ (grille officielle V4).
    id: 'pro',
    label: 'Solo Pro',
    description: 'Le choix recommandé pour les diagnostiqueurs en activité',
    priceMonthlyCents: 5900,
    priceAnnualCents: annualCentsWithDiscount(5900),
    storageGb: 25,
    usersIncluded: 1,
    fairUseMissionsSoftCap: 150,
    hardCapWhisperSeconds: 10 * 3600,
    hardCapVisionCalls: 100,
    hardCapBurstPerDay: 30,
    recommended: true,
    featured: true,
  },
  {
    // Tier `all_inclusive` legacy E2c — remappé vers Cabinet 149€ (grille officielle V4).
    id: 'all_inclusive',
    label: 'Cabinet',
    description: 'Multi-utilisateurs (3 inclus) + gouvernance',
    priceMonthlyCents: 14900,
    priceAnnualCents: annualCentsWithDiscount(14900),
    storageGb: 100,
    usersIncluded: 3,
    extraUserPriceCents: 1900,
    maxUsers: 7,
    fairUseMissionsSoftCap: 400,
    hardCapWhisperSeconds: 40 * 3600,
    hardCapVisionCalls: 600,
    hardCapBurstPerDay: 60,
  },
  {
    // Tier `cabinet` legacy E2c — remappé vers Cabinet+ 299€ (grille officielle V4).
    // Les anciens abonnements DB à 89€ migrent vers Cabinet+ via LEGACY_PLAN_MAP.
    id: 'cabinet',
    label: 'Cabinet+',
    description: 'API publique + SLA 4h + onboarding white-glove',
    priceMonthlyCents: 29900,
    priceAnnualCents: annualCentsWithDiscount(29900),
    storageGb: 250,
    usersIncluded: 7,
    extraUserPriceCents: 1900,
    maxUsers: 7,
    fairUseMissionsSoftCap: 999_999,
    hardCapWhisperSeconds: 80 * 3600,
    hardCapVisionCalls: 1500,
    hardCapBurstPerDay: 100,
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
