/**
 * KOVAS — Pricing V3 Dual Track (validée fondateur 2026-05-21)
 *
 * Architecture en deux tracks distincts achetables séparément ou via Bundle :
 *   - KOVAS Annuaire (B2C) : 4 plans + 6 slots sponsorisés ville
 *   - KOVAS 360 (B2B logiciel) : 5 plans (free / starter / active / cabinet / enterprise)
 *   - Bundles (5 combos Annuaire + Logiciel à prix réduit)
 *   - Add-ons (4 modules indépendants des tracks)
 *
 * Cf. docs/pricing/v3-dual-track-spec.md pour la spec exhaustive.
 *
 * IMPORTANT — prix exprimés en centimes (integer), jamais float ni string.
 * Cf. CLAUDE.md §10 — Conventions formats régionaux.
 *
 * Rétro-compat : la grille E2c 5-tiers reste accessible via LEGACY_PLANS et
 * les helpers existants (getPlanByCode, FEATURE_MATRIX, etc.) pour ne pas
 * casser les 50+ composants qui en dépendent. Les utilisateurs E2c migrés
 * conservent leurs prix historiques via les codes `*_legacy`.
 */

const SECONDS_PER_HOUR = 3600

// ════════════════════════════════════════════════════════════════
// 1. TRACK ANNUAIRE B2C — 4 plans
// ════════════════════════════════════════════════════════════════

export type AnnuairePlanCode =
  | 'annuaire_free'
  | 'annuaire_pro'
  | 'annuaire_visibility'
  | 'annuaire_sponsored'

export interface AnnuairePlan {
  readonly code: AnnuairePlanCode
  readonly name: string
  readonly tagline: string
  readonly monthlyPrice: number // centimes HT
  readonly annualPrice: number // centimes HT (2 mois offerts)
  readonly leadsPerMonth: number
  readonly ficheLevel: 'verified' | 'premium' | 'sponsored'
  readonly features: readonly string[]
  readonly featured?: boolean
}

export const ANNUAIRE_PLANS: readonly AnnuairePlan[] = [
  {
    code: 'annuaire_free',
    name: 'Annuaire Vérifié',
    tagline: 'Fiche publique gratuite — claim done',
    monthlyPrice: 0,
    annualPrice: 0,
    leadsPerMonth: 0,
    ficheLevel: 'verified',
    features: [
      'Fiche publique vérifiée',
      'Coordonnées + zone d’intervention',
      'Lecture seule (pas de réception de leads)',
    ],
  },
  {
    code: 'annuaire_pro',
    name: 'Annuaire Pro',
    tagline: 'Recevez vos premiers leads particuliers',
    monthlyPrice: 1900,
    annualPrice: 19000,
    leadsPerMonth: 5,
    ficheLevel: 'premium',
    features: [
      '5 leads particuliers / mois',
      'Fiche Premium (photos, services, tarifs indicatifs)',
      'Réponse directe via messagerie KOVAS',
    ],
  },
  {
    code: 'annuaire_visibility',
    name: 'Annuaire Visibilité',
    tagline: 'Boost SEO local + analytics fiche',
    monthlyPrice: 3900,
    annualPrice: 39000,
    leadsPerMonth: 15,
    ficheLevel: 'premium',
    featured: true,
    features: [
      '15 leads particuliers / mois',
      'Fiche Premium + boost SEO local',
      'Analytics fiche (vues, clics, conversion)',
    ],
  },
  {
    code: 'annuaire_sponsored',
    name: 'Annuaire Sponsorisé',
    tagline: 'Top département + badge Recommandé',
    monthlyPrice: 7900,
    annualPrice: 79000,
    leadsPerMonth: 30,
    ficheLevel: 'sponsored',
    features: [
      '30 leads premium / mois',
      'Top département + badge "Recommandé"',
      'Éligible aux slots ville sponsorisés (cf. SPONSORED_SLOT_TIERS)',
    ],
  },
] as const

export function getAnnuairePlan(code: AnnuairePlanCode): AnnuairePlan | undefined {
  return ANNUAIRE_PLANS.find((plan) => plan.code === code)
}

// ════════════════════════════════════════════════════════════════
// 2. TRACK KOVAS 360 (LOGICIEL B2B) — 5 plans
// ════════════════════════════════════════════════════════════════

export type LogicielPlanCode =
  | 'logiciel_free'
  | 'logiciel_starter'
  | 'logiciel_active'
  | 'logiciel_cabinet'
  | 'logiciel_enterprise'

/** Sentinelle "illimité" pour les caps numériques. */
export const UNLIMITED_CAP = 999_999

export interface LogicielPlan {
  readonly code: LogicielPlanCode
  readonly name: string
  readonly tagline: string
  readonly monthlyPrice: number // centimes HT
  readonly annualPrice: number // centimes HT
  readonly caps: {
    readonly missions: number // UNLIMITED_CAP pour fair-use illimité
    readonly whisperSeconds: number
    readonly visionCalls: number
    readonly storageGb: number
    readonly users: number
  }
  readonly features: readonly string[]
  readonly featured?: boolean
}

export const LOGICIEL_PLANS: readonly LogicielPlan[] = [
  {
    code: 'logiciel_free',
    name: 'Essai 14 jours',
    tagline: 'Pour découvrir KOVAS 360 sans CB',
    monthlyPrice: 0,
    annualPrice: 0,
    caps: {
      missions: 30,
      whisperSeconds: 1 * SECONDS_PER_HOUR,
      visionCalls: 0,
      storageGb: 5,
      users: 1,
    },
    features: [
      '30 missions sur 14 jours (cap anti-abus)',
      '1h Whisper / essai',
      "Exports universels (PDF · Word · CSV · JSON · ZIP)",
      'Sync iPad · iPhone · Web',
    ],
  },
  {
    code: 'logiciel_starter',
    name: 'Starter',
    tagline: 'Démarrer en solo sur les diagnostics standards',
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
      '5h Whisper',
      '12 Go stockage',
      '8 diagnostics standards (DPE / Amiante / Plomb / Gaz / Élec / Termites / Carrez / ERP)',
      'Sync mobile / web + offline',
    ],
  },
  {
    code: 'logiciel_active',
    name: 'Active',
    tagline: 'Le choix recommandé pour les diagnostiqueurs en activité',
    monthlyPrice: 5900,
    annualPrice: 59000,
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
      '10h Whisper + Vision IA (100 / mo)',
      'Recos post-DPE F/G automatiques',
      'Validation cohérence métier',
      'Templates pièces + support 4h ouvré',
    ],
  },
  {
    code: 'logiciel_cabinet',
    name: 'Cabinet',
    tagline: 'Multi-utilisateurs (3 inclus) + gouvernance',
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
      '40h Whisper + Vision IA (600 / mo)',
      'Audit trail + analytics avancés',
      'Factur-X PPF inclus + gestion des rôles',
      'Account manager dédié',
    ],
  },
  {
    code: 'logiciel_enterprise',
    name: 'Enterprise',
    tagline: 'API publique + SLA 4h + onboarding white-glove',
    monthlyPrice: 29900,
    annualPrice: 299000,
    caps: {
      missions: UNLIMITED_CAP,
      whisperSeconds: 80 * SECONDS_PER_HOUR,
      visionCalls: 1500,
      storageGb: 250,
      users: 10,
    },
    features: [
      'Missions illimitées (fair-use)',
      '80h Whisper + Vision IA (1 500 / mo)',
      'API publique REST + webhooks',
      'SLA 4h ouvré + onboarding white-glove',
      'Multi-utilisateurs 10+ extensibles',
    ],
  },
] as const

export function getLogicielPlan(code: LogicielPlanCode): LogicielPlan | undefined {
  return LOGICIEL_PLANS.find((plan) => plan.code === code)
}

// ════════════════════════════════════════════════════════════════
// 3. BUNDLES — 5 combos Annuaire + Logiciel à prix réduit
// ════════════════════════════════════════════════════════════════

export type BundleCode =
  | 'bundle_starter_visibility'
  | 'bundle_active_pro'
  | 'bundle_active_visibility'
  | 'bundle_cabinet_pro'
  | 'bundle_cabinet_visibility'

export interface BundleCombo {
  readonly code: BundleCode
  readonly name: string
  readonly tagline: string
  readonly annuaireComponent: AnnuairePlanCode
  readonly logicielComponent: LogicielPlanCode
  readonly monthlyPrice: number // centimes HT (bundle remisé)
  readonly annualPrice: number // centimes HT
  readonly savingsPerMonth: number // centimes économisés vs achat séparé
  /** Alias UI de savingsPerMonth — utilisé par BundlesGrid / PlanFeatureMatrix */
  readonly monthlySavingsCents: number
  /** Prix mensuel combiné des composants achetés séparément (centimes HT) */
  readonly individualMonthlyPriceCents: number
  /** Libellés humanlisibles des composants (pour affichage card) */
  readonly includedPlanLabels: readonly string[]
  readonly featured?: boolean
}

export const BUNDLES: readonly BundleCombo[] = [
  {
    code: 'bundle_starter_visibility',
    name: 'Starter + Annuaire Pro',
    tagline: 'Idéal premier installé',
    annuaireComponent: 'annuaire_pro',
    logicielComponent: 'logiciel_starter',
    monthlyPrice: 3900,
    annualPrice: 39000,
    savingsPerMonth: 900,
    monthlySavingsCents: 900,
    individualMonthlyPriceCents: 4800,
    includedPlanLabels: ['Annuaire Pro 19€', 'KOVAS 360 Starter 29€'],
  },
  {
    code: 'bundle_active_pro',
    name: 'Active + Annuaire Pro',
    tagline: 'Combo recommandé',
    annuaireComponent: 'annuaire_pro',
    logicielComponent: 'logiciel_active',
    monthlyPrice: 6900,
    annualPrice: 69000,
    savingsPerMonth: 900,
    monthlySavingsCents: 900,
    individualMonthlyPriceCents: 7800,
    includedPlanLabels: ['Annuaire Pro 19€', 'KOVAS 360 Active 59€'],
    featured: true,
  },
  {
    code: 'bundle_active_visibility',
    name: 'Active + Annuaire Visibilité',
    tagline: 'Boost activité',
    annuaireComponent: 'annuaire_visibility',
    logicielComponent: 'logiciel_active',
    monthlyPrice: 8900,
    annualPrice: 89000,
    savingsPerMonth: 900,
    monthlySavingsCents: 900,
    individualMonthlyPriceCents: 9800,
    includedPlanLabels: ['Annuaire Visibilité 39€', 'KOVAS 360 Active 59€'],
  },
  {
    code: 'bundle_cabinet_pro',
    name: 'Cabinet + Annuaire Pro',
    tagline: 'Cabinet visible',
    annuaireComponent: 'annuaire_pro',
    logicielComponent: 'logiciel_cabinet',
    monthlyPrice: 14900,
    annualPrice: 149000,
    savingsPerMonth: 1900,
    monthlySavingsCents: 1900,
    individualMonthlyPriceCents: 16800,
    includedPlanLabels: ['Annuaire Pro 19€', 'KOVAS 360 Cabinet 149€'],
  },
  {
    code: 'bundle_cabinet_visibility',
    name: 'Cabinet + Annuaire Visibilité',
    tagline: 'Cabinet recommandé',
    annuaireComponent: 'annuaire_visibility',
    logicielComponent: 'logiciel_cabinet',
    monthlyPrice: 16900,
    annualPrice: 169000,
    savingsPerMonth: 1900,
    monthlySavingsCents: 1900,
    individualMonthlyPriceCents: 18800,
    includedPlanLabels: ['Annuaire Visibilité 39€', 'KOVAS 360 Cabinet 149€'],
  },
] as const

export function getBundle(code: BundleCode): BundleCombo | undefined {
  return BUNDLES.find((bundle) => bundle.code === code)
}

export function getBundleSavings(code: BundleCode): number {
  return getBundle(code)?.savingsPerMonth ?? 0
}

// ════════════════════════════════════════════════════════════════
// 4. SPONSORED SLOTS — 6 paliers par taille de ville
// ════════════════════════════════════════════════════════════════

export type SponsoredSlotCategory =
  | 'metropole'
  | 'grande_ville'
  | 'ville_moyenne'
  | 'petite_ville'
  | 'commune'
  | 'rural'

export interface SponsoredSlotTier {
  readonly category: SponsoredSlotCategory
  readonly label: string
  readonly populationMin: number
  readonly populationMax: number | null // null = pas de borne haute
  readonly monthlyPrice: number // centimes HT
  readonly annualPrice: number // centimes HT
}

export const SPONSORED_SLOT_TIERS: readonly SponsoredSlotTier[] = [
  {
    category: 'metropole',
    label: 'Métropole (> 500k hab.)',
    populationMin: 500_000,
    populationMax: null,
    monthlyPrice: 19900,
    annualPrice: 199000,
  },
  {
    category: 'grande_ville',
    label: 'Grande ville (200k–500k)',
    populationMin: 200_000,
    populationMax: 500_000,
    monthlyPrice: 11900,
    annualPrice: 119000,
  },
  {
    category: 'ville_moyenne',
    label: 'Ville moyenne (50k–200k)',
    populationMin: 50_000,
    populationMax: 200_000,
    monthlyPrice: 7900,
    annualPrice: 79000,
  },
  {
    category: 'petite_ville',
    label: 'Petite ville (10k–50k)',
    populationMin: 10_000,
    populationMax: 50_000,
    monthlyPrice: 3900,
    annualPrice: 39000,
  },
  {
    category: 'commune',
    label: 'Commune (3k–10k)',
    populationMin: 3_000,
    populationMax: 10_000,
    monthlyPrice: 1900,
    annualPrice: 19000,
  },
  {
    category: 'rural',
    label: 'Rural (< 3k)',
    populationMin: 0,
    populationMax: 3_000,
    monthlyPrice: 900,
    annualPrice: 9000,
  },
] as const

export function getSponsoredSlotTier(
  category: SponsoredSlotCategory,
): SponsoredSlotTier | undefined {
  return SPONSORED_SLOT_TIERS.find((tier) => tier.category === category)
}

/** Retourne le palier matchant une population donnée (hab.). */
export function findSponsoredSlotForPopulation(
  population: number,
): SponsoredSlotTier | undefined {
  return SPONSORED_SLOT_TIERS.find((tier) => {
    if (population < tier.populationMin) return false
    if (tier.populationMax === null) return true
    return population < tier.populationMax
  })
}

// ════════════════════════════════════════════════════════════════
// 5. ADD-ONS V3 — 4 modules indépendants
// ════════════════════════════════════════════════════════════════

/**
 * Codes d'add-ons reconnus côté SaaS.
 *
 * V3 introduit 4 nouveaux codes préfixés `addon_*` ; ADDON_MODULES ne
 * contient QUE ces 4 entrées. Les anciens codes E2c (préfixe vide) restent
 * dans le type union pour préserver la compilation des consumers existants
 * (`UPSELL_CATALOG`, `behavioral-triggers`, sidebar, `mobile-more-sheet`),
 * qui seront migrés en lot B3.
 *
 * Codes V3 actifs (présents dans `ADDON_MODULES`) :
 *   - `addon_signatures_eidas` · `addon_pennylane_sync`
 *   - `addon_sms_reminders` · `addon_community_pro`
 *
 * Codes legacy conservés sous nouveau nom (réf. transitoire) :
 *   - `signatures_eidas` · `pennylane_sync` · `sms_reminders` · `community_pro`
 *
 * Codes legacy abandonnés (à retirer en B3) :
 *   - `bilingual_reports` · `facturx_ppf` · `analytics_advanced`
 *   - `regulatory_watch` · `cockpit_ademe_m2`
 */
export type AddonCode =
  // V3 — présents dans ADDON_MODULES
  | 'addon_signatures_eidas'
  | 'addon_pennylane_sync'
  | 'addon_sms_reminders'
  | 'addon_community_pro'
  // Legacy E2c — référencés par consumers (à migrer B3)
  | 'signatures_eidas'
  | 'pennylane_sync'
  | 'sms_reminders'
  | 'community_pro'
  | 'bilingual_reports'
  | 'facturx_ppf'
  | 'analytics_advanced'
  | 'regulatory_watch'
  | 'cockpit_ademe_m2'

/** Sous-ensemble strict des 4 codes V3 actifs (pour les writes Stripe / DB). */
export type AddonCodeV3 =
  | 'addon_signatures_eidas'
  | 'addon_pennylane_sync'
  | 'addon_sms_reminders'
  | 'addon_community_pro'

/** @deprecated alias historique — utiliser AddonCode. */
export type LegacyAddonCode =
  | 'signatures_eidas'
  | 'pennylane_sync'
  | 'sms_reminders'
  | 'community_pro'
  | 'bilingual_reports'
  | 'facturx_ppf'
  | 'analytics_advanced'
  | 'regulatory_watch'
  | 'cockpit_ademe_m2'

/** @deprecated — alias historique, utiliser AddonCode directement. */
export type AnyAddonCode = AddonCode

export interface AddonModule {
  readonly code: AddonCode
  readonly name: string
  readonly description: string
  readonly monthlyPrice: number // centimes HT
  readonly includedQuantity: number | null // null = illimité
  readonly overagePrice: number | null // centimes HT par unité
  readonly overageUnit: string | null // 'sig' / 'SMS' / etc.
  /** Plans dans lesquels l'addon est inclus de base (LogicielPlanCode + legacy). */
  readonly includedInPlans: readonly PricingPlanCode[]
  readonly trialDays: number
}

export const ADDON_MODULES: readonly AddonModule[] = [
  {
    code: 'addon_signatures_eidas',
    name: 'Signatures électroniques eIDAS',
    description: 'Signature qualifiée Yousign opposable juridiquement',
    monthlyPrice: 1900,
    includedQuantity: 10,
    overagePrice: 400,
    overageUnit: 'sig',
    includedInPlans: [],
    trialDays: 14,
  },
  {
    code: 'addon_pennylane_sync',
    name: 'Synchronisation Pennylane',
    description: 'Export automatique missions + factures vers Pennylane',
    monthlyPrice: 900,
    includedQuantity: null,
    overagePrice: null,
    overageUnit: null,
    includedInPlans: [],
    trialDays: 14,
  },
  {
    code: 'addon_sms_reminders',
    name: 'SMS rappel client J-1',
    description: 'Rappel SMS automatique la veille de chaque visite (France métropolitaine)',
    monthlyPrice: 900,
    includedQuantity: 50,
    overagePrice: 25,
    overageUnit: 'SMS',
    includedInPlans: [],
    trialDays: 14,
  },
  {
    code: 'addon_community_pro',
    name: 'Communauté Pro',
    description: 'Accès au cercle privé des diagnostiqueurs KOVAS',
    monthlyPrice: 900,
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

// ════════════════════════════════════════════════════════════════
// 6. RÉTRO-COMPAT E2c — PricingPlan + LEGACY_PLANS + PRICING_PLANS
// ════════════════════════════════════════════════════════════════

/** Ancien grille E2c 5-tiers (display publique). Référencé par 50+ composants. */
export type LegacyPlanCode = 'essential' | 'decouverte' | 'pro' | 'all_inclusive' | 'cabinet'

/** Codes grandfather (suffixe `_legacy`) — prix historiques préservés. */
export type GrandfatherPlanCode =
  | 'essential_legacy'
  | 'decouverte_legacy'
  | 'pro_legacy'
  | 'all_inclusive_legacy'
  | 'cabinet_legacy'

/**
 * Union élargie des codes plan reconnus côté SaaS.
 *
 * Comprend : 5 codes V3 logiciel + 5 codes E2c legacy + 5 codes grandfather.
 * Les helpers `getPlanByCode`, `getFairUseCaps`, `FEATURE_MATRIX` couvrent
 * tous ces codes pour préserver la rétro-compat.
 */
export type PricingPlanCode = LogicielPlanCode | LegacyPlanCode | GrandfatherPlanCode

export interface FairUseCaps {
  readonly missionsSoftCap: number
  readonly whisperSecondsHardCap: number
  readonly visionCallsHardCap: number
  readonly burstMissionsPerDay: number
}

/** Shape canonique d'un plan SaaS (compatible LogicielPlan et legacy E2c). */
export interface PricingPlan {
  readonly code: PricingPlanCode
  readonly name: string
  readonly tagline: string
  readonly monthlyPrice: number // centimes HT
  readonly annualPrice: number // centimes HT (10× mensuel = 2 mois offerts)
  readonly caps: {
    readonly missions: number
    readonly whisperSeconds: number
    readonly visionCalls: number
    readonly storageGb: number
    readonly users: number
  }
  readonly features: readonly string[]
  readonly featured?: boolean
}

/**
 * Plans E2c grandfather — prix historiques préservés à vie.
 *
 * Mapping (cf. spec v3 §6) :
 *   - essential_legacy   → caps Starter ; prix 19 € (vs 29 € V3)
 *   - decouverte_legacy  → caps Starter ; prix 29 € (identique)
 *   - pro_legacy         → caps Active  ; prix 39 € (vs 59 €)
 *   - all_inclusive_legacy → caps Cabinet ; prix 99 € (vs 149 €)
 *   - cabinet_legacy     → caps Cabinet ; prix 149 € (identique)
 */
export const LEGACY_PLANS: readonly PricingPlan[] = [
  {
    code: 'essential_legacy',
    name: 'Essential (héritage)',
    tagline: 'Plan E2c grandfather — prix 19 € préservé à vie',
    monthlyPrice: 1900,
    annualPrice: 19000,
    caps: {
      missions: 30,
      whisperSeconds: 1 * SECONDS_PER_HOUR,
      visionCalls: 0,
      storageGb: 5,
      users: 1,
    },
    features: ['Plan grandfather — prix 19 €/mo à vie'],
  },
  {
    code: 'decouverte_legacy',
    name: 'Découverte (héritage)',
    tagline: 'Plan E2c grandfather — prix 29 € préservé à vie',
    monthlyPrice: 2900,
    annualPrice: 29000,
    caps: {
      missions: 60,
      whisperSeconds: 5 * SECONDS_PER_HOUR,
      visionCalls: 0,
      storageGb: 12,
      users: 1,
    },
    features: ['Plan grandfather — prix 29 €/mo à vie'],
  },
  {
    code: 'pro_legacy',
    name: 'Pro (héritage)',
    tagline: 'Plan E2c grandfather — prix 39 € préservé à vie',
    monthlyPrice: 3900,
    annualPrice: 39000,
    caps: {
      missions: 150,
      whisperSeconds: 10 * SECONDS_PER_HOUR,
      visionCalls: 100,
      storageGb: 25,
      users: 1,
    },
    features: ['Plan grandfather — prix 39 €/mo à vie'],
  },
  {
    code: 'all_inclusive_legacy',
    name: 'All Inclusive (héritage)',
    tagline: 'Plan E2c grandfather — prix 99 € préservé à vie',
    monthlyPrice: 9900,
    annualPrice: 99000,
    caps: {
      missions: 250,
      whisperSeconds: 25 * SECONDS_PER_HOUR,
      visionCalls: 200,
      storageGb: 80,
      users: 1,
    },
    features: ['Plan grandfather — prix 99 €/mo à vie'],
  },
  {
    code: 'cabinet_legacy',
    name: 'Cabinet (héritage)',
    tagline: 'Plan E2c grandfather — prix 149 € préservé à vie',
    monthlyPrice: 14900,
    annualPrice: 149000,
    caps: {
      missions: 400,
      whisperSeconds: 40 * SECONDS_PER_HOUR,
      visionCalls: 600,
      storageGb: 100,
      users: 3,
    },
    features: ['Plan grandfather — prix 149 €/mo à vie'],
  },
] as const

/**
 * PRICING_PLANS — alias rétro-compat pour itération.
 *
 * Composition : 5 plans V3 logiciel + 5 plans grandfather (lecture seule).
 * Les composants /pricing publics doivent filtrer hors `*_legacy` pour
 * n'afficher que les plans V3. Le code legacy est conservé pour back-office.
 */
export const PRICING_PLANS: readonly PricingPlan[] = [
  ...LOGICIEL_PLANS,
  ...LEGACY_PLANS,
] as const

export function getPricingPlan(code: PricingPlanCode): PricingPlan | undefined {
  return PRICING_PLANS.find((plan) => plan.code === code)
}

/** Alias rétro-compat utilisé par calculator, checkout, etc. */
export const getPlanByCode = getPricingPlan

/** Alias rétro-compat (anciennes call sites). */
export const getAddonByCode = (code: AddonCode): AddonModule | undefined => getAddon(code)

/** Vérifie si un add-on est inclus dans un plan donné. */
export function isAddonIncluded(addon: AddonModule, planCode: PricingPlanCode | null): boolean {
  if (planCode === null) return false
  return addon.includedInPlans.includes(planCode)
}

/** Rétro-compat : accesseur fair-use calculé depuis caps. */
export function getFairUseCaps(planCode: PricingPlanCode | null | undefined): FairUseCaps | null {
  if (!planCode) return null
  const plan = getPricingPlan(planCode)
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

/** Économie annuelle (centimes) vs 12× prix mensuel. */
export function getAnnualSavings(
  plan: PricingPlan | LogicielPlan | AnnuairePlan | BundleCombo,
): number {
  const twelveMonths = plan.monthlyPrice * 12
  return Math.max(0, twelveMonths - plan.annualPrice)
}

/** Discriminateurs typés legacy / grandfather. */
const LEGACY_PLAN_CODES = new Set<string>([
  'essential',
  'decouverte',
  'pro',
  'all_inclusive',
  'cabinet',
])

const GRANDFATHER_PLAN_CODES = new Set<string>([
  'essential_legacy',
  'decouverte_legacy',
  'pro_legacy',
  'all_inclusive_legacy',
  'cabinet_legacy',
])

export function isLegacyPlan(code: string | null | undefined): code is LegacyPlanCode {
  if (!code) return false
  return LEGACY_PLAN_CODES.has(code)
}

export function isGrandfatherPlan(
  code: string | null | undefined,
): code is GrandfatherPlanCode {
  if (!code) return false
  return GRANDFATHER_PLAN_CODES.has(code)
}

// ════════════════════════════════════════════════════════════════
// 7. ADDON_PACKS — DEPRECATED V3 (remplacé par BUNDLES)
// ════════════════════════════════════════════════════════════════

/**
 * @deprecated V3 — l'architecture pack a été remplacée par BUNDLES (combo
 * Annuaire + Logiciel). Cet export reste pour ne pas casser AddonPicker et
 * DiscoverDrawer pendant la migration B3. Les helpers retournent toujours
 * undefined / 0.
 */
export type AddonPackCode = 'pack_growth' | 'pack_cabinet' | 'pack_international'

/** @deprecated cf. AddonPackCode. */
export interface AddonPack {
  readonly code: AddonPackCode
  readonly name: string
  readonly monthlyPrice: number
  readonly annualPrice: number
  readonly description: string
  readonly includedAddons: readonly AddonCode[]
  readonly bundleLimits: Partial<Record<AddonCode, number>>
  readonly savings: number
  readonly featured?: boolean
}

/** @deprecated — vide en V3, à supprimer en B3 après migration des composants. */
export const ADDON_PACKS: readonly AddonPack[] = [] as const

/** @deprecated. */
export function getAddonPack(_code: AddonPackCode): AddonPack | undefined {
  return undefined
}

/** @deprecated. */
export function getAddonsByPack(_packCode: AddonPackCode): readonly AddonModule[] {
  return []
}

/** @deprecated — retourne toujours 0 en V3 (architecture Bundle). */
export function calculateAddonsSavings(_addonCodes: readonly AddonCode[]): number {
  return 0
}

// ════════════════════════════════════════════════════════════════
// 8. FEATURE_MATRIX — rétro-compat /pricing/compare
// ════════════════════════════════════════════════════════════════

/**
 * Matrice features × forfaits pour la page `/pricing/compare`.
 *
 * Couvre TOUS les codes plan reconnus (5 V3 logiciel + 5 legacy E2c + 5
 * grandfather) afin de satisfaire `Record<PricingPlanCode, ...>` exhaustif.
 * Les composants /pricing publics filtrent généralement à LOGICIEL_PLANS,
 * les codes legacy / grandfather sont là pour la cohérence type.
 */
export interface FeatureRow {
  readonly category: string
  readonly feature: string
  readonly plans: Record<PricingPlanCode, boolean | string>
}

/** Helper interne pour construire une ligne de la matrice avec mapping legacy → V3. */
function buildFeatureRow(
  category: string,
  feature: string,
  values: Record<LogicielPlanCode, boolean | string>,
): FeatureRow {
  // Mapping logique : legacy E2c et grandfather pointent vers le V3 le plus
  // proche (essential/essential_legacy → starter, pro → active, etc.).
  return {
    category,
    feature,
    plans: {
      // V3 logiciel
      logiciel_free: values.logiciel_free,
      logiciel_starter: values.logiciel_starter,
      logiciel_active: values.logiciel_active,
      logiciel_cabinet: values.logiciel_cabinet,
      logiciel_enterprise: values.logiciel_enterprise,
      // Legacy E2c (display publique encore référencée)
      essential: values.logiciel_starter,
      decouverte: values.logiciel_starter,
      pro: values.logiciel_active,
      all_inclusive: values.logiciel_cabinet,
      cabinet: values.logiciel_cabinet,
      // Grandfather (back-office)
      essential_legacy: values.logiciel_starter,
      decouverte_legacy: values.logiciel_starter,
      pro_legacy: values.logiciel_active,
      all_inclusive_legacy: values.logiciel_cabinet,
      cabinet_legacy: values.logiciel_cabinet,
    },
  }
}

export const FEATURE_MATRIX: readonly FeatureRow[] = [
  buildFeatureRow(
    'Diagnostics',
    '8 diagnostics standards (DPE / Amiante / Plomb / Gaz / Élec / Termites / Carrez / ERP)',
    {
      logiciel_free: true,
      logiciel_starter: true,
      logiciel_active: true,
      logiciel_cabinet: true,
      logiciel_enterprise: true,
    },
  ),
  buildFeatureRow('IA', 'Saisie vocale Whisper', {
    logiciel_free: '1h essai',
    logiciel_starter: '5h/mo',
    logiciel_active: '10h/mo',
    logiciel_cabinet: '40h/mo',
    logiciel_enterprise: '80h/mo',
  }),
  buildFeatureRow('IA', 'Vision IA reconnaissance équipements', {
    logiciel_free: false,
    logiciel_starter: false,
    logiciel_active: '100/mo',
    logiciel_cabinet: '600/mo',
    logiciel_enterprise: '1 500/mo',
  }),
  buildFeatureRow('Stockage', 'Capacité cloud', {
    logiciel_free: '5 Go',
    logiciel_starter: '12 Go',
    logiciel_active: '25 Go',
    logiciel_cabinet: '100 Go',
    logiciel_enterprise: '250 Go',
  }),
  buildFeatureRow('Comptes', "Nombre d'utilisateurs", {
    logiciel_free: '1',
    logiciel_starter: '1',
    logiciel_active: '1',
    logiciel_cabinet: '3',
    logiciel_enterprise: '10+',
  }),
  buildFeatureRow('Devis & Factures', 'Module Devis + Factures Factur-X', {
    logiciel_free: false,
    logiciel_starter: true,
    logiciel_active: true,
    logiciel_cabinet: true,
    logiciel_enterprise: true,
  }),
  buildFeatureRow('Annuaire', 'Niveau de fiche annuaire (track séparé)', {
    logiciel_free: 'Vérifié',
    logiciel_starter: 'Vérifié',
    logiciel_active: 'Premium',
    logiciel_cabinet: 'Premium',
    logiciel_enterprise: 'Premium',
  }),
  buildFeatureRow('Support', 'Support email', {
    logiciel_free: '48h',
    logiciel_starter: '48h',
    logiciel_active: '24h',
    logiciel_cabinet: '12h',
    logiciel_enterprise: '4h SLA',
  }),
] as const

// ════════════════════════════════════════════════════════════════
// 9. ALIAS & HELPERS DE COMPATIBILITÉ (B3 UI dependencies)
// ════════════════════════════════════════════════════════════════

/** Alias court de BundleCombo — utilisé par les composants UI (B3). */
export type Bundle = BundleCombo

/**
 * Mapping d'un plan E2c legacy vers son équivalent V3 grandfather.
 * Utilisé par `LegacyGrandfatherBanner` pour afficher le passage.
 */
export interface LegacyPlanMapping {
  readonly legacyDisplayName: string
  readonly grandfatherCode: GrandfatherPlanCode
  readonly grandfatherMonthlyPriceCents: number
  readonly suggestedNewPlanCode: LogicielPlanCode
}

const LEGACY_PLAN_MAPPING: Readonly<Record<LegacyPlanCode, LegacyPlanMapping>> = {
  essential: {
    legacyDisplayName: 'Essential (héritage)',
    grandfatherCode: 'essential_legacy',
    grandfatherMonthlyPriceCents: 1900,
    suggestedNewPlanCode: 'logiciel_starter',
  },
  decouverte: {
    legacyDisplayName: 'Découverte (héritage)',
    grandfatherCode: 'decouverte_legacy',
    grandfatherMonthlyPriceCents: 2900,
    suggestedNewPlanCode: 'logiciel_starter',
  },
  pro: {
    legacyDisplayName: 'Pro (héritage)',
    grandfatherCode: 'pro_legacy',
    grandfatherMonthlyPriceCents: 3900,
    suggestedNewPlanCode: 'logiciel_active',
  },
  all_inclusive: {
    legacyDisplayName: 'All Inclusive (héritage)',
    grandfatherCode: 'all_inclusive_legacy',
    grandfatherMonthlyPriceCents: 9900,
    suggestedNewPlanCode: 'logiciel_cabinet',
  },
  cabinet: {
    legacyDisplayName: 'Cabinet (héritage)',
    grandfatherCode: 'cabinet_legacy',
    grandfatherMonthlyPriceCents: 14900,
    suggestedNewPlanCode: 'logiciel_cabinet',
  },
}

/** Récupère le mapping legacy → V3 grandfather pour un plan E2c historique. */
export function getLegacyPlanMapping(code: LegacyPlanCode): LegacyPlanMapping {
  return LEGACY_PLAN_MAPPING[code]
}
