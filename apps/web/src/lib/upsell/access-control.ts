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

/**
 * Hiérarchie tiers pour comparaisons `>=`.
 *
 * Couvre TOUS les codes plan reconnus (V3 logiciel + legacy E2c + grandfather)
 * afin de satisfaire `Record<PricingPlanCode, number>` exhaustif. Mapping
 * grandfather → rank du V3 le plus proche.
 */
const PLAN_RANK: Record<PricingPlanCode, number> = {
  // V4 officiels (grille 2026-05-22)
  essai: 0,
  solo_light: 1,
  solo_pro: 3,
  cabinet: 5,
  cabinet_plus: 6,
  // Alias V3 historiques
  logiciel_free: 0,
  logiciel_starter: 1,
  logiciel_active: 3,
  logiciel_cabinet: 5,
  logiciel_enterprise: 6,
  // Legacy E2c (display publique)
  essential: 1,
  decouverte: 2,
  pro: 3,
  all_inclusive: 4,
  // Grandfather (prix historiques préservés)
  essential_legacy: 1,
  decouverte_legacy: 2,
  pro_legacy: 3,
  all_inclusive_legacy: 4,
  cabinet_legacy: 5,
  standard_legacy: 3,
  volume_legacy: 4,
  founder_legacy: 3,
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
    isPremium: tierAtLeast(access.planCode, 'solo_pro'),
    isCabinet: access.planCode === 'cabinet' || access.planCode === 'cabinet_plus',
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
