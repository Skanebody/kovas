/**
 * KOVAS — Pricing finale (E2c, validée fondateur 2026-06-02)
 *
 * 5 tiers + 9 add-ons (modèle forfait+inclus+overage) + 3 packs thématiques.
 * Cf. CLAUDE.md §4 et docs/pricing-final-2026-06-02.md
 *
 * IMPORTANT : prix exprimés en centimes (integer) — jamais float ni string.
 * Cf. CLAUDE.md §10 — Conventions formats régionaux.
 */

// ─────────────────────────────────────────────
// Tiers
// ─────────────────────────────────────────────

export type PricingPlanCode =
  | 'essential'
  | 'decouverte'
  | 'pro'
  | 'all_inclusive'
  | 'cabinet'

export interface FairUseCaps {
  readonly missionsSoftCap: number
  readonly whisperSecondsHardCap: number
  readonly visionCallsHardCap: number
  readonly burstMissionsPerDay: number
}

export interface PricingPlan {
  code: PricingPlanCode
  name: string
  tagline: string
  monthlyPrice: number // centimes HT
  annualPrice: number // centimes HT (10× = 2 mois offerts)
  caps: {
    missions: number
    whisperSeconds: number
    visionCalls: number
    storageGb: number
    users: number
  }
  featured?: boolean
  features: readonly string[]
}

/** Rétro-compat : accesseur fairUse calculé depuis caps. Utilisé par les composants legacy. */
export function getFairUseCaps(planCode: PricingPlanCode | null | undefined): FairUseCaps | null {
  if (!planCode) return null
  const plan = PRICING_PLANS.find((p) => p.code === planCode)
  if (!plan) return null
  return {
    missionsSoftCap: plan.caps.missions,
    whisperSecondsHardCap: plan.caps.whisperSeconds,
    visionCallsHardCap: plan.caps.visionCalls,
    burstMissionsPerDay: Math.ceil(plan.caps.missions / 5),
  }
}

/** Rétro-compat : prix annuel HT (centimes). */
export function getAnnualPrice(plan: PricingPlan): number {
  return plan.annualPrice
}

const SECONDS_PER_HOUR = 3600

export const PRICING_PLANS: readonly PricingPlan[] = [
  {
    code: 'essential',
    name: 'Essential',
    tagline: 'Pour démarrer ou tester votre flux KOVAS',
    monthlyPrice: 1900,
    annualPrice: 19000,
    caps: {
      missions: 30,
      whisperSeconds: 1 * SECONDS_PER_HOUR,
      visionCalls: 0,
      storageGb: 5,
      users: 1,
    },
    features: [
      '30 missions / mois',
      '1h de saisie vocale Whisper',
      '5 Go de stockage',
      "Tous les exports universels (PDF · Word · CSV · JSON · ZIP)",
      "Sync iPad · iPhone · Web",
    ],
  },
  {
    code: 'decouverte',
    name: 'Découverte',
    tagline: 'Le tier d’entrée pour valider le gain de temps',
    monthlyPrice: 2900,
    annualPrice: 29000,
    caps: {
      missions: 60,
      whisperSeconds: 5 * SECONDS_PER_HOUR,
      visionCalls: 0,
      storageGb: 12,
      users: 1,
    },
    features: [
      '60 missions / mois',
      '5h de saisie vocale Whisper',
      '12 Go de stockage',
      'Tous les exports universels',
      'Templates pièces + check-lists métier',
    ],
  },
  {
    code: 'pro',
    name: 'Pro',
    tagline: 'Le choix recommandé pour les diagnostiqueurs actifs',
    monthlyPrice: 3900,
    annualPrice: 39000,
    caps: {
      missions: 150,
      whisperSeconds: 10 * SECONDS_PER_HOUR,
      visionCalls: 100,
      storageGb: 25,
      users: 1,
    },
    featured: true,
    features: [
      '150 missions / mois',
      '10h de saisie vocale Whisper',
      '100 reconnaissances Vision IA',
      '25 Go de stockage',
      'Validation cohérence avancée',
      'Support prioritaire sous 4h',
    ],
  },
  {
    code: 'all_inclusive',
    name: 'All Inclusive',
    tagline: 'Pour les power users en activité soutenue',
    monthlyPrice: 9900,
    annualPrice: 99000,
    caps: {
      missions: 250,
      whisperSeconds: 25 * SECONDS_PER_HOUR,
      visionCalls: 200,
      storageGb: 80,
      users: 1,
    },
    features: [
      '250 missions / mois',
      '25h de saisie vocale Whisper',
      '200 reconnaissances Vision IA',
      '80 Go de stockage',
      'Accès anticipé fonctionnalités Phase 2',
    ],
  },
  {
    code: 'cabinet',
    name: 'Cabinet',
    tagline: 'Jusqu’à 3 utilisateurs pour les cabinets en équipe',
    monthlyPrice: 14900,
    annualPrice: 149000,
    caps: {
      missions: 400,
      whisperSeconds: 40 * SECONDS_PER_HOUR,
      visionCalls: 600,
      storageGb: 100,
      users: 3,
    },
    features: [
      '400 missions / mois pour 3 utilisateurs',
      '40h de saisie vocale Whisper',
      '600 reconnaissances Vision IA',
      '100 Go de stockage',
      'Gestion des rôles (admin · technicien · viewer)',
      'Account manager dédié',
    ],
  },
] as const

export function getPricingPlan(code: PricingPlanCode): PricingPlan | undefined {
  return PRICING_PLANS.find((plan) => plan.code === code)
}

// ─────────────────────────────────────────────
// Add-ons (modèle forfait + inclus + overage)
// ─────────────────────────────────────────────

export type AddonCode =
  | 'signatures_eidas'
  | 'bilingual_reports'
  | 'sms_reminders'
  | 'pennylane_sync'
  | 'facturx_ppf'
  | 'community_pro'
  | 'analytics_advanced'
  | 'regulatory_watch'
  | 'cockpit_ademe_m2'

export interface AddonModule {
  code: AddonCode
  name: string
  description: string
  monthlyPrice: number // centimes HT
  includedQuantity: number | null // null = illimité
  overagePrice: number | null // centimes HT par unité ; null = pas d’overage
  overageUnit: string | null // 'sig' / 'rapport' / 'SMS' / 'facture'
  includedInPlans: readonly PricingPlanCode[]
  trialDays: number
}

export const ADDON_MODULES: readonly AddonModule[] = [
  {
    code: 'signatures_eidas',
    name: 'Signatures électroniques eIDAS',
    description: 'Signature qualifiée Yousign opposable juridiquement',
    monthlyPrice: 1800,
    includedQuantity: 5,
    overagePrice: 400,
    overageUnit: 'sig',
    includedInPlans: [],
    trialDays: 14,
  },
  {
    code: 'bilingual_reports',
    name: 'Rapports bilingues FR/EN',
    description: 'Traduction professionnelle des rapports de diagnostic',
    monthlyPrice: 1900,
    includedQuantity: 5,
    overagePrice: 800,
    overageUnit: 'rapport',
    includedInPlans: [],
    trialDays: 14,
  },
  {
    code: 'sms_reminders',
    name: 'SMS rappel client J-1',
    description: 'Rappel automatique la veille de la visite (FR uniquement)',
    monthlyPrice: 1200,
    includedQuantity: 50,
    overagePrice: 25,
    overageUnit: 'SMS',
    includedInPlans: [],
    trialDays: 14,
  },
  {
    code: 'pennylane_sync',
    name: 'Synchronisation Pennylane',
    description: 'Export automatique des missions et factures vers Pennylane',
    monthlyPrice: 1500,
    includedQuantity: null,
    overagePrice: null,
    overageUnit: null,
    includedInPlans: [],
    trialDays: 14,
  },
  {
    code: 'facturx_ppf',
    name: 'Facturation Factur-X PPF Iopole',
    description: 'Émission de factures électroniques conformes (obligation 2027)',
    monthlyPrice: 2200,
    includedQuantity: 100,
    overagePrice: 30,
    overageUnit: 'facture',
    includedInPlans: [],
    trialDays: 14,
  },
  {
    code: 'community_pro',
    name: 'Communauté Pro',
    description: 'Accès à la communauté privée des diagnostiqueurs KOVAS',
    monthlyPrice: 900,
    includedQuantity: null,
    overagePrice: null,
    overageUnit: null,
    includedInPlans: [],
    trialDays: 14,
  },
  {
    code: 'analytics_advanced',
    name: 'Analytics avancés cabinet',
    description: 'Tableaux de bord détaillés, KPIs métier, exports analytiques',
    monthlyPrice: 2400,
    includedQuantity: null,
    overagePrice: null,
    overageUnit: null,
    includedInPlans: [],
    trialDays: 14,
  },
  {
    code: 'regulatory_watch',
    name: 'Veille IA hebdomadaire',
    description: 'Digest IA des évolutions réglementaires du diagnostic immobilier',
    monthlyPrice: 1200,
    includedQuantity: 4,
    overagePrice: null,
    overageUnit: null,
    includedInPlans: [],
    trialDays: 14,
  },
  {
    code: 'cockpit_ademe_m2',
    name: 'Cockpit ADEME Mode 2',
    description: 'Pilotage avancé des envois ADEME (lots, retours, anomalies)',
    monthlyPrice: 1500,
    includedQuantity: null,
    overagePrice: null,
    overageUnit: null,
    includedInPlans: [],
    trialDays: 14,
  },
] as const

export function getAddon(code: AddonCode): AddonModule | undefined {
  return ADDON_MODULES.find((addon) => addon.code === code)
}

// ─────────────────────────────────────────────
// Packs thématiques (réduction vs add-ons à l’unité)
// ─────────────────────────────────────────────

export type AddonPackCode = 'pack_growth' | 'pack_cabinet' | 'pack_international'

export interface AddonPack {
  code: AddonPackCode
  name: string
  monthlyPrice: number // centimes HT
  annualPrice: number // centimes HT
  description: string
  includedAddons: readonly AddonCode[]
  bundleLimits: Partial<Record<AddonCode, number>>
  savings: number // €/mo économisés vs add-ons à l’unité
  featured?: boolean
}

export const ADDON_PACKS: readonly AddonPack[] = [
  {
    code: 'pack_growth',
    name: 'Pack Croissance',
    monthlyPrice: 2900,
    annualPrice: 29000,
    description: 'Veille IA hebdo + Cockpit ADEME M2 + Communauté Pro',
    includedAddons: ['regulatory_watch', 'cockpit_ademe_m2', 'community_pro'],
    bundleLimits: {},
    savings: 7,
    featured: true,
  },
  {
    code: 'pack_cabinet',
    name: 'Pack Cabinet',
    monthlyPrice: 4900,
    annualPrice: 49000,
    description: 'Analytics avancés + Pennylane + Factur-X PPF (100 factures incluses)',
    includedAddons: ['analytics_advanced', 'pennylane_sync', 'facturx_ppf'],
    bundleLimits: { facturx_ppf: 100 },
    savings: 12,
  },
  {
    code: 'pack_international',
    name: 'Pack International',
    monthlyPrice: 2500,
    annualPrice: 25000,
    description: '3 signatures eIDAS + 3 rapports bilingues FR/EN inclus chaque mois',
    includedAddons: ['signatures_eidas', 'bilingual_reports'],
    bundleLimits: { signatures_eidas: 3, bilingual_reports: 3 },
    savings: 15,
  },
] as const

export function getAddonPack(code: AddonPackCode): AddonPack | undefined {
  return ADDON_PACKS.find((pack) => pack.code === code)
}

export function getAddonsByPack(packCode: AddonPackCode): readonly AddonModule[] {
  const pack = getAddonPack(packCode)
  if (!pack) return []
  return pack.includedAddons
    .map((code) => getAddon(code))
    .filter((addon): addon is AddonModule => addon !== undefined)
}

/**
 * Calcule l’économie mensuelle d’un sous-ensemble d’add-ons s’ils étaient
 * tous achetés via un pack qui les inclut entièrement.
 *
 * Retourne 0 si aucun pack ne couvre l’ensemble exact, sinon le delta
 * en centimes entre la somme des add-ons à l’unité et le prix du pack.
 */
export function calculateAddonsSavings(addonCodes: readonly AddonCode[]): number {
  if (addonCodes.length === 0) return 0
  const unique = Array.from(new Set(addonCodes))

  let best = 0
  for (const pack of ADDON_PACKS) {
    const covered = pack.includedAddons.every((code) => unique.includes(code))
    const matchesExactly = covered && pack.includedAddons.length === unique.length
    if (!matchesExactly) continue

    const unitTotal = pack.includedAddons.reduce((sum, code) => {
      const addon = getAddon(code)
      return addon ? sum + addon.monthlyPrice : sum
    }, 0)
    const delta = unitTotal - pack.monthlyPrice
    if (delta > best) best = delta
  }
  return best
}

// ─────────────────────────────────────────────
// Rétro-compat exports (composants P9 / legacy)
// ─────────────────────────────────────────────

export const LEGACY_PLANS = [] as const
export type PricingLegacyCode = never

export function isLegacyPlan(_code: string | null | undefined): _code is PricingLegacyCode {
  return false
}

/** Alias rétro-compat pour les composants utilisant l'ancien nom. */
export const getAddonByCode = getAddon
export const getPlanByCode = getPricingPlan

/** Vérifie si un add-on est inclus dans un plan donné. */
export function isAddonIncluded(addon: AddonModule, planCode: PricingPlanCode | null): boolean {
  if (planCode === null) return false
  return addon.includedInPlans.includes(planCode)
}

/** Matrice features pour la page /pricing/compare (rétro-compat). */
export interface FeatureRow {
  category: string
  feature: string
  plans: Record<PricingPlanCode, boolean | string>
}

export const FEATURE_MATRIX: readonly FeatureRow[] = [
  {
    category: 'Diagnostics',
    feature: '8 diagnostics standards (DPE, Amiante, Plomb, Gaz, Élec, Termites, Carrez, ERP)',
    plans: { essential: true, decouverte: true, pro: true, all_inclusive: true, cabinet: true },
  },
  {
    category: 'IA',
    feature: 'Saisie vocale Whisper',
    plans: { essential: '1h/mo', decouverte: '5h/mo', pro: '10h/mo', all_inclusive: '25h/mo', cabinet: '40h/mo' },
  },
  {
    category: 'IA',
    feature: 'Vision IA reconnaissance équipements',
    plans: { essential: false, decouverte: false, pro: '100/mo', all_inclusive: '200/mo', cabinet: '600/mo' },
  },
  {
    category: 'Stockage',
    feature: 'Capacité cloud',
    plans: { essential: '5 Go', decouverte: '12 Go', pro: '25 Go', all_inclusive: '80 Go', cabinet: '100 Go' },
  },
  {
    category: 'Comptes',
    feature: "Nombre d'utilisateurs",
    plans: { essential: '1', decouverte: '1', pro: '1', all_inclusive: '1', cabinet: '3 (+19€/user, max 10)' },
  },
  {
    category: 'Devis & Factures',
    feature: 'Module Devis + Factures Factur-X',
    plans: { essential: true, decouverte: true, pro: true, all_inclusive: true, cabinet: true },
  },
  {
    category: 'Annuaire',
    feature: 'Niveau de fiche annuaire',
    plans: { essential: 'Vérifié', decouverte: 'Vérifié', pro: 'Premium', all_inclusive: 'Premium', cabinet: 'Premium' },
  },
  {
    category: 'Support',
    feature: 'Support email',
    plans: { essential: '48h', decouverte: '48h', pro: '24h', all_inclusive: '24h', cabinet: '12h' },
  },
] as const
