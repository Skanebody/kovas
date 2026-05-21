/**
 * KOVAS — Access control helpers pour upsell intelligent (L1).
 *
 * Source de vérité unique pour répondre à : "ce user a-t-il accès à X ?".
 * X = tier minimum requis (ex. Pro+) ET/OU un addon spécifique actif.
 *
 * Tous les helpers sont synchrones : on charge l'UserAccess une fois (server)
 * puis on l'utilise partout (sidebar, drawer, FeatureGate, modaux).
 *
 * Cf. docs/upsell-architecture.md
 */

import {
  type AddonCode,
  type AddonPackCode,
  getAddonPack,
  type PricingPlanCode,
} from '@/lib/pricing-plans'

/** Hiérarchie tiers pour comparaisons `>=`. */
const PLAN_RANK: Record<PricingPlanCode, number> = {
  essential: 1,
  decouverte: 2,
  pro: 3,
  all_inclusive: 4,
  cabinet: 5,
}

export interface UserAccess {
  /** Plan actif (null si user sans abonnement). */
  planCode: PricingPlanCode | null
  /** Addons directement souscrits (status active OR trialing). */
  activeAddons: readonly AddonCode[]
  /** Packs directement souscrits (status active OR trialing). */
  activePacks: readonly AddonPackCode[]
}

export interface FeatureRequirement {
  requiredTier?: PricingPlanCode
  requiredAddons?: readonly AddonCode[]
}

/** Retourne le rang du plan (0 si null). */
export function planRank(planCode: PricingPlanCode | null | undefined): number {
  if (!planCode) return 0
  return PLAN_RANK[planCode] ?? 0
}

/** True si tierA >= tierB. */
export function tierAtLeast(
  current: PricingPlanCode | null | undefined,
  minimum: PricingPlanCode,
): boolean {
  return planRank(current) >= planRank(minimum)
}

/**
 * Renvoie la liste des addons effectivement accessibles à l'utilisateur :
 *   - addons directement souscrits
 *   - addons inclus dans les packs souscrits
 */
export function getEffectiveAddons(access: UserAccess): readonly AddonCode[] {
  const set = new Set<AddonCode>(access.activeAddons)
  for (const packCode of access.activePacks) {
    const pack = getAddonPack(packCode)
    if (!pack) continue
    for (const code of pack.includedAddons) set.add(code)
  }
  return Array.from(set)
}

/**
 * True si l'utilisateur dispose de la feature (tier + tous les addons requis).
 */
export function hasFeatureAccess(
  access: UserAccess,
  feature: FeatureRequirement,
): boolean {
  // Tier minimum
  if (feature.requiredTier && !tierAtLeast(access.planCode, feature.requiredTier)) {
    return false
  }
  // Addons requis (tous, AND logique)
  if (feature.requiredAddons && feature.requiredAddons.length > 0) {
    const effective = new Set(getEffectiveAddons(access))
    for (const code of feature.requiredAddons) {
      if (!effective.has(code)) return false
    }
  }
  return true
}

/** Helpers de présentation rapides. */
export function getActiveFeatures(access: UserAccess): {
  tiers: PricingPlanCode[]
  addons: AddonCode[]
  isPremium: boolean
  isCabinet: boolean
} {
  const rank = planRank(access.planCode)
  const tiers: PricingPlanCode[] = []
  for (const [code, r] of Object.entries(PLAN_RANK) as Array<[PricingPlanCode, number]>) {
    if (r <= rank) tiers.push(code)
  }
  return {
    tiers,
    addons: Array.from(getEffectiveAddons(access)),
    isPremium: tierAtLeast(access.planCode, 'pro'),
    isCabinet: access.planCode === 'cabinet',
  }
}

/**
 * Filtre une liste d'items (nav, sections, etc.) selon l'accès utilisateur.
 * Un item sans requirement est toujours conservé.
 */
export function filterNavItemsByAccess<T extends FeatureRequirement>(
  items: readonly T[],
  access: UserAccess,
): T[] {
  return items.filter((item) => hasFeatureAccess(access, item))
}
