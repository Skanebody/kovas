/**
 * KOVAS — Mapping plan_code → Stripe Price ID (Pricing V3 dual track)
 *
 * Centralise les Stripe Price IDs pour les 5 surfaces commerciales V3 :
 *   - KOVAS Annuaire (3 tiers payants × 2 cycles = 6 vars)
 *   - KOVAS 360 logiciel (4 tiers payants × 2 cycles = 8 vars)
 *   - Bundles Annuaire + Logiciel (5 combos × 2 cycles = 10 vars)
 *   - Slots sponsorisés par taille de ville (6 niveaux × 2 cycles = 12 vars)
 *   - Add-ons modules indépendants (4 modules × 2 cycles = 8 vars)
 *
 * Total : 44 variables d'environnement Stripe (cf. .env.example).
 *
 * Les Price IDs sont créés manuellement dans le dashboard Stripe (ou via le
 * script `scripts/stripe-provision-plans.ts`) puis exposés via les variables
 * d'environnement `STRIPE_PRICE_<PRODUCT_TYPE>_<CODE>_<CYCLE>`.
 *
 * Source de vérité côté code : `apps/web/src/lib/pricing-plans.ts` (types).
 * Source de vérité côté produit : `docs/pricing/v3-dual-track-spec.md`.
 *
 * Convention de naming :
 *   STRIPE_PRICE_ANNUAIRE_<TIER>_<CYCLE>      → ex. STRIPE_PRICE_ANNUAIRE_PRO_MONTHLY
 *   STRIPE_PRICE_LOGICIEL_<TIER>_<CYCLE>      → ex. STRIPE_PRICE_LOGICIEL_ACTIVE_ANNUAL
 *   STRIPE_PRICE_BUNDLE_<BUNDLE>_<CYCLE>      → ex. STRIPE_PRICE_BUNDLE_ACTIVE_PRO_MONTHLY
 *   STRIPE_PRICE_SLOT_<CATEGORY>_<CYCLE>      → ex. STRIPE_PRICE_SLOT_METROPOLE_MONTHLY
 *   STRIPE_PRICE_ADDON_<MODULE>_<CYCLE>       → ex. STRIPE_PRICE_ADDON_SIGNATURES_EIDAS_MONTHLY
 */

import type {
  AnnuairePlanCode,
  LogicielPlanCode,
  BundleCode,
  AddonCodeV3,
  SponsoredSlotCategory,
} from '@/lib/pricing-plans'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type BillingCycle = 'monthly' | 'annual'

export type StripeProductType =
  | 'annuaire'
  | 'logiciel'
  | 'bundle'
  | 'sponsored_slot'
  | 'addon'

export interface StripePriceIds {
  readonly monthly: string | null
  readonly annual: string | null
}

// ─────────────────────────────────────────────
// Annuaire — 3 tiers payants (annuaire_free exclu, pas de paiement Stripe)
// ─────────────────────────────────────────────

export const STRIPE_ANNUAIRE_PRICES: Record<
  Exclude<AnnuairePlanCode, 'annuaire_free'>,
  StripePriceIds
> = {
  annuaire_pro: {
    monthly: process.env.STRIPE_PRICE_ANNUAIRE_PRO_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_ANNUAIRE_PRO_ANNUAL ?? null,
  },
  annuaire_visibility: {
    monthly: process.env.STRIPE_PRICE_ANNUAIRE_VISIBILITY_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_ANNUAIRE_VISIBILITY_ANNUAL ?? null,
  },
  annuaire_sponsored: {
    monthly: process.env.STRIPE_PRICE_ANNUAIRE_SPONSORED_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_ANNUAIRE_SPONSORED_ANNUAL ?? null,
  },
}

// ─────────────────────────────────────────────
// Logiciel KOVAS 360 — 4 tiers payants (logiciel_free exclu)
// ─────────────────────────────────────────────

export const STRIPE_LOGICIEL_PRICES: Record<
  Exclude<LogicielPlanCode, 'logiciel_free'>,
  StripePriceIds
> = {
  logiciel_starter: {
    monthly: process.env.STRIPE_PRICE_LOGICIEL_STARTER_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_LOGICIEL_STARTER_ANNUAL ?? null,
  },
  logiciel_active: {
    monthly: process.env.STRIPE_PRICE_LOGICIEL_ACTIVE_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_LOGICIEL_ACTIVE_ANNUAL ?? null,
  },
  logiciel_cabinet: {
    monthly: process.env.STRIPE_PRICE_LOGICIEL_CABINET_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_LOGICIEL_CABINET_ANNUAL ?? null,
  },
  logiciel_enterprise: {
    monthly: process.env.STRIPE_PRICE_LOGICIEL_ENTERPRISE_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_LOGICIEL_ENTERPRISE_ANNUAL ?? null,
  },
}

// ─────────────────────────────────────────────
// Bundles — 5 combos Annuaire + Logiciel
// ─────────────────────────────────────────────

export const STRIPE_BUNDLE_PRICES: Record<BundleCode, StripePriceIds> = {
  bundle_starter_visibility: {
    monthly: process.env.STRIPE_PRICE_BUNDLE_STARTER_VISIBILITY_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_BUNDLE_STARTER_VISIBILITY_ANNUAL ?? null,
  },
  bundle_active_pro: {
    monthly: process.env.STRIPE_PRICE_BUNDLE_ACTIVE_PRO_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_BUNDLE_ACTIVE_PRO_ANNUAL ?? null,
  },
  bundle_active_visibility: {
    monthly: process.env.STRIPE_PRICE_BUNDLE_ACTIVE_VISIBILITY_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_BUNDLE_ACTIVE_VISIBILITY_ANNUAL ?? null,
  },
  bundle_cabinet_pro: {
    monthly: process.env.STRIPE_PRICE_BUNDLE_CABINET_PRO_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_BUNDLE_CABINET_PRO_ANNUAL ?? null,
  },
  bundle_cabinet_visibility: {
    monthly: process.env.STRIPE_PRICE_BUNDLE_CABINET_VISIBILITY_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_BUNDLE_CABINET_VISIBILITY_ANNUAL ?? null,
  },
}

// ─────────────────────────────────────────────
// Slots sponsorisés — 6 catégories de ville (réservés au tier annuaire_sponsored)
// ─────────────────────────────────────────────

export const STRIPE_SPONSORED_SLOT_PRICES: Record<
  SponsoredSlotCategory,
  StripePriceIds
> = {
  metropole: {
    monthly: process.env.STRIPE_PRICE_SLOT_METROPOLE_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_SLOT_METROPOLE_ANNUAL ?? null,
  },
  grande_ville: {
    monthly: process.env.STRIPE_PRICE_SLOT_GRANDE_VILLE_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_SLOT_GRANDE_VILLE_ANNUAL ?? null,
  },
  ville_moyenne: {
    monthly: process.env.STRIPE_PRICE_SLOT_VILLE_MOYENNE_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_SLOT_VILLE_MOYENNE_ANNUAL ?? null,
  },
  petite_ville: {
    monthly: process.env.STRIPE_PRICE_SLOT_PETITE_VILLE_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_SLOT_PETITE_VILLE_ANNUAL ?? null,
  },
  commune: {
    monthly: process.env.STRIPE_PRICE_SLOT_COMMUNE_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_SLOT_COMMUNE_ANNUAL ?? null,
  },
  rural: {
    monthly: process.env.STRIPE_PRICE_SLOT_RURAL_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_SLOT_RURAL_ANNUAL ?? null,
  },
}

// ─────────────────────────────────────────────
// Add-ons V3 — 4 modules indépendants (signatures, pennylane, sms, communauté)
// ─────────────────────────────────────────────

export const STRIPE_ADDON_PRICES: Record<AddonCodeV3, StripePriceIds> = {
  addon_signatures_eidas: {
    monthly: process.env.STRIPE_PRICE_ADDON_SIGNATURES_EIDAS_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_ADDON_SIGNATURES_EIDAS_ANNUAL ?? null,
  },
  addon_pennylane_sync: {
    monthly: process.env.STRIPE_PRICE_ADDON_PENNYLANE_SYNC_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_ADDON_PENNYLANE_SYNC_ANNUAL ?? null,
  },
  addon_sms_reminders: {
    monthly: process.env.STRIPE_PRICE_ADDON_SMS_REMINDERS_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_ADDON_SMS_REMINDERS_ANNUAL ?? null,
  },
  addon_community_pro: {
    monthly: process.env.STRIPE_PRICE_ADDON_COMMUNITY_PRO_MONTHLY ?? null,
    annual: process.env.STRIPE_PRICE_ADDON_COMMUNITY_PRO_ANNUAL ?? null,
  },
}

// ─────────────────────────────────────────────
// Lookup helper
// ─────────────────────────────────────────────

/**
 * Retourne le Stripe Price ID configuré pour un produit V3 + son cycle.
 *
 * Retourne null si :
 *   - le `code` est inconnu pour ce `productType`
 *   - le code correspond à un plan gratuit (`annuaire_free` / `logiciel_free`)
 *   - le Price ID env var n'est pas configuré
 *
 * Les appelants (route checkout) doivent traiter `null` comme une erreur 503
 * "Stripe Price ID non configuré".
 */
export function getStripePriceId(
  productType: StripeProductType,
  code: string,
  billingCycle: BillingCycle,
): string | null {
  switch (productType) {
    case 'annuaire': {
      if (code === 'annuaire_free') return null
      const entry =
        STRIPE_ANNUAIRE_PRICES[code as Exclude<AnnuairePlanCode, 'annuaire_free'>]
      return entry ? entry[billingCycle] : null
    }
    case 'logiciel': {
      if (code === 'logiciel_free') return null
      const entry =
        STRIPE_LOGICIEL_PRICES[code as Exclude<LogicielPlanCode, 'logiciel_free'>]
      return entry ? entry[billingCycle] : null
    }
    case 'bundle': {
      const entry = STRIPE_BUNDLE_PRICES[code as BundleCode]
      return entry ? entry[billingCycle] : null
    }
    case 'sponsored_slot': {
      const entry = STRIPE_SPONSORED_SLOT_PRICES[code as SponsoredSlotCategory]
      return entry ? entry[billingCycle] : null
    }
    case 'addon': {
      const entry = STRIPE_ADDON_PRICES[code as AddonCodeV3]
      return entry ? entry[billingCycle] : null
    }
    default:
      return null
  }
}

/**
 * Helper introspection : retourne true si la variable d'environnement
 * STRIPE_PRICE_* correspondante est configurée. Utile pour dev / health check.
 */
export function isStripePriceConfigured(
  productType: StripeProductType,
  code: string,
  billingCycle: BillingCycle,
): boolean {
  return getStripePriceId(productType, code, billingCycle) !== null
}
