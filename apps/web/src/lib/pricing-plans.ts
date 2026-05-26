/**
 * KOVAS — Pricing V5 grille officielle (refonte mockup 2026-05-25, Lot B43)
 *
 * Architecture en deux tracks distincts achetables séparément ou via Bundle :
 *   - Track Logiciel KOVAS (B2B) : 5 plans
 *       essai / solo_light (Solo) / solo_pro (Pro) / cabinet / cabinet_plus
 *   - Track Annuaire KOVAS (B2C)    : 4 plans
 *       annuaire_free / annuaire_local (Présence) / annuaire_regional (Boost) /
 *       annuaire_national (Premium)
 *   - Bundles cross-sell             : 5 combos remisés
 *   - Add-ons                        : 4 modules optionnels
 *   - Sponsorisé dynamique           : 6 paliers par tranche ville
 *
 * V5 (2026-05-25) — changements majeurs vs V4 :
 *   - Logiciel : Solo (29€, 40 missions) / Pro (79€ vs 59€, 100 missions) /
 *     Cabinet (199€ vs 149€, 300 missions, 5 users vs 3) / Cabinet+ (499€ vs
 *     299€, 1000 missions, 15 users vs 7)
 *   - Annuaire : renaming d'affichage uniquement (Local→Présence, Régional→Boost,
 *     National→Premium). Prix inchangés.
 *   - Bundles : recompositions et prix recalibrés (39/99/89/229/529€)
 *   - Trial extended : essai 30j + satisfait ou remboursé 60j
 *   - Loyalty progressive : -15% annuel + -5% à M12 + -10% à M24 (cap -30%)
 *
 * IMPORTANT — prix exprimés en centimes (integer), jamais float ni string.
 * Cf. CLAUDE.md §10 — Conventions formats régionaux.
 *
 * Rétro-compat : les codes V3 historiques (`logiciel_*`, `annuaire_pro/visibility/sponsored`)
 * et les anciens prix V4 sont conservés comme alias / grandfather pour ne pas
 * casser les 50+ composants qui en dépendent. Les anciens abonnés gardent leur
 * prix historique à vie via les `*_legacy` plans dans `LEGACY_PLANS`.
 */

const SECONDS_PER_HOUR = 3600

// ════════════════════════════════════════════════════════════════
// 1. TRACK LOGICIEL — 5 plans officiels V5 (29 / 79 / 199 / 499 €)
// ════════════════════════════════════════════════════════════════

/** Codes officiels du track logiciel KOVAS (grille 2026-05-22). */
export type LogicielPlanCode =
  | 'essai'
  | 'solo_light'
  | 'solo_pro'
  | 'cabinet'
  | 'cabinet_plus'
  // Alias rétrocompat V3 (générés via les mêmes objets — voir LOGICIEL_PLANS).
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
  readonly annualPrice: number // centimes HT (engagement annuel -15%)
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

/** Calcule le prix annuel HT (centimes) avec engagement annuel -15%. */
function annualPriceWithDiscount(monthlyCents: number): number {
  // Engagement annuel = 12× prix mensuel × 0,85 (-15%).
  return Math.round(monthlyCents * 12 * 0.85)
}

/**
 * Plans officiels track logiciel V5 (refonte mockup 2026-05-25).
 *
 * - Essai gratuit       : 0 € — 30 jours puis débit auto vers Solo
 * - Solo (solo_light)   : 29 € — 24,65 € annuel (-15%) · 40 missions, surplus 0,99€
 * - Pro (solo_pro)      : 79 € — 67,15 € annuel · 100 missions, surplus 0,79€
 * - Cabinet             : 199 € — 169,15 € annuel · 300 missions, surplus 0,59€, 5 users
 * - Cabinet+            : 499 € — 424,15 € annuel · 1000 missions, surplus 0,29€, 15 users
 *
 * Note interne : les codes plan (`solo_light`, `solo_pro`) restent inchangés
 * pour préserver la rétro-compat des 50+ composants ; seuls les `name`,
 * `monthlyPrice` et `caps` sont mis à jour. Le mapping `LEGACY_PLAN_MAP` et
 * les `*_legacy` grandfather préservent les anciens abonnés.
 */
export const LOGICIEL_PLANS: readonly LogicielPlan[] = [
  {
    code: 'essai',
    name: 'Essai gratuit',
    tagline: 'Pour découvrir KOVAS · 30 jours · CB enregistrée, débit auto à J+30',
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
      '30 jours d’essai complet · CB enregistrée à la souscription, débit auto à J+30',
      'Satisfait ou remboursé sous 60 jours',
      '30 missions max sur la période (cap anti-abus)',
      '1h Whisper inclus',
      'Exports universels (PDF · Word · CSV · JSON · ZIP)',
      'Sync iPad · iPhone · Web',
    ],
  },
  {
    code: 'solo_light',
    name: 'Solo',
    tagline: 'Tu démarres ou tu fais environ 10 missions par semaine',
    monthlyPrice: 2900,
    annualPrice: annualPriceWithDiscount(2900),
    caps: {
      missions: 40,
      whisperSeconds: 5 * SECONDS_PER_HOUR,
      visionCalls: 0,
      storageGb: 12,
      users: 1,
    },
    features: [
      '40 missions / mois · surplus 0,99€ / mission',
      'Notes vocales transcrites automatiquement',
      'Photos plaques lues automatiquement',
      'Vérification automatique avant ADEME',
      'Mise à jour des normes en continu',
      'Facturation Qonto + Pennylane',
      'Signature électronique légale',
      '1 utilisateur',
    ],
  },
  {
    code: 'solo_pro',
    name: 'Pro',
    tagline: 'Tu travailles à temps plein, 15 à 25 missions par semaine',
    monthlyPrice: 7900,
    annualPrice: annualPriceWithDiscount(7900),
    caps: {
      missions: 100,
      whisperSeconds: 10 * SECONDS_PER_HOUR,
      visionCalls: 100,
      storageGb: 25,
      users: 1,
    },
    featured: true,
    features: [
      '100 missions / mois · surplus 0,79€ / mission',
      'Tout Solo, plus :',
      'Suivi du temps gagné chaque semaine',
      'Tableau de bord (CA, devis, conversion)',
      'Templates de rapports illimités',
      'Facturation conforme 2027 (Factur-X)',
      'Historique complet des biens',
      'Relances impayés automatiques',
      'Réponse support sous 1 jour ouvré',
      '1 invité lecture seule',
    ],
  },
  {
    code: 'cabinet',
    name: 'Cabinet',
    tagline: 'Tu travailles en équipe de 2 à 5 personnes',
    monthlyPrice: 19900,
    annualPrice: annualPriceWithDiscount(19900),
    caps: {
      missions: 300,
      whisperSeconds: 40 * SECONDS_PER_HOUR,
      visionCalls: 600,
      storageGb: 100,
      users: 5,
    },
    features: [
      '300 missions / mois · surplus 0,59€ / mission',
      'Tout Pro, plus :',
      '5 utilisateurs avec rôles distincts',
      'Workload distribution + planning équipe',
      'Audit trail par membre (qui a fait quoi)',
      'Dashboard manager (productivité, CA par diag)',
      'Alerte si DPE existe déjà sur le bien',
      'Aide à la défense en cas de plainte',
      'Branding cabinet personnalisé',
      'Réponse support sous 4 heures ouvrées',
    ],
  },
  {
    code: 'cabinet_plus',
    name: 'Cabinet+',
    tagline: 'Tu pilotes 6 à 15 personnes sur un ou plusieurs sites',
    monthlyPrice: 49900,
    annualPrice: annualPriceWithDiscount(49900),
    caps: {
      missions: 1000,
      whisperSeconds: 80 * SECONDS_PER_HOUR,
      visionCalls: 1500,
      storageGb: 250,
      users: 15,
    },
    features: [
      '1000 missions / mois · surplus 0,29€ / mission',
      'Tout Cabinet, plus :',
      '15 utilisateurs inclus',
      'Reporting consolidé multi-sites',
      'White-label complet (logo + couleurs)',
      'Vérification renforcée incluse',
      'Échange direct avec Benjamin, le fondateur',
      'Onboarding sur-mesure de ton équipe',
      'Réponse support sous 1 heure ouvrée',
      'Personnalisation avancée du workflow',
    ],
  },
] as const

export function getLogicielPlan(code: LogicielPlanCode): LogicielPlan | undefined {
  // Résout d'abord les alias V3 historiques vers leur équivalent officiel.
  const canonical = resolveLogicielAlias(code)
  return LOGICIEL_PLANS.find((plan) => plan.code === canonical)
}

/** Mapping alias V3 historique → code officiel V4 (2026-05-22). */
const LOGICIEL_ALIAS_MAP: Readonly<Record<string, LogicielPlanCode>> = {
  logiciel_free: 'essai',
  logiciel_starter: 'solo_light',
  logiciel_active: 'solo_pro',
  logiciel_cabinet: 'cabinet',
  logiciel_enterprise: 'cabinet_plus',
}

function resolveLogicielAlias(code: LogicielPlanCode): LogicielPlanCode {
  return LOGICIEL_ALIAS_MAP[code] ?? code
}

// ════════════════════════════════════════════════════════════════
// 2. TRACK ANNUAIRE B2C — 4 plans officiels (0 / 19 / 39 / 79 €)
// ════════════════════════════════════════════════════════════════

/** Codes officiels du track Annuaire KOVAS. */
export type AnnuairePlanCode =
  | 'annuaire_free'
  | 'annuaire_local'
  | 'annuaire_regional'
  | 'annuaire_national'
  // Alias rétrocompat V3 historique.
  | 'annuaire_pro'
  | 'annuaire_visibility'
  | 'annuaire_sponsored'

export interface AnnuairePlan {
  readonly code: AnnuairePlanCode
  readonly name: string
  readonly tagline: string
  readonly monthlyPrice: number // centimes HT
  readonly annualPrice: number // centimes HT (engagement annuel -15%)
  readonly leadsPerMonth: number
  readonly ficheLevel: 'verified' | 'premium' | 'sponsored'
  readonly features: readonly string[]
  readonly featured?: boolean
}

export const ANNUAIRE_PLANS: readonly AnnuairePlan[] = [
  {
    code: 'annuaire_free',
    name: 'Fiche réclamée',
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
    code: 'annuaire_local',
    name: 'Présence',
    tagline: 'Les particuliers de ton département te trouvent en priorité',
    monthlyPrice: 1900,
    annualPrice: annualPriceWithDiscount(1900),
    leadsPerMonth: 5,
    ficheLevel: 'premium',
    features: [
      'Fiche publique sur l’annuaire KOVAS',
      'Tes 3 derniers avis Google affichés',
      'Indicateur de disponibilité de la semaine',
      'Statistiques de ta fiche (vues, contacts)',
      'Réception de demandes de devis qualifiés',
      'Tu paies seulement les leads qui t’intéressent',
    ],
  },
  {
    code: 'annuaire_regional',
    name: 'Boost',
    tagline: 'Tu passes devant tes concurrents dans les résultats',
    monthlyPrice: 3900,
    annualPrice: annualPriceWithDiscount(3900),
    leadsPerMonth: 15,
    ficheLevel: 'premium',
    featured: true,
    features: [
      'Tout Présence, plus :',
      'Position prioritaire (top 5 département)',
      '1 commune mise en avant',
      'Badge Vérifié bleu sur ta fiche',
      'Notifications de leads en temps réel',
      '−20% sur ton premier lead du mois',
    ],
  },
  {
    code: 'annuaire_national',
    name: 'Premium',
    tagline: 'Tu captures tout le marché de ta région',
    monthlyPrice: 7900,
    annualPrice: annualPriceWithDiscount(7900),
    leadsPerMonth: 30,
    ficheLevel: 'sponsored',
    features: [
      'Tout Boost, plus :',
      'Visibilité multi-départements (top 3 région)',
      '3 communes mises en avant',
      'Badge Premium doré',
      '−50% sur tes 3 premiers leads du mois',
      'Promesse de réponse client le jour même',
      'Support prioritaire',
    ],
  },
] as const

/** Mapping alias V3 → code officiel V4 pour le track Annuaire. */
const ANNUAIRE_ALIAS_MAP: Readonly<Record<string, AnnuairePlanCode>> = {
  annuaire_pro: 'annuaire_local',
  annuaire_visibility: 'annuaire_regional',
  annuaire_sponsored: 'annuaire_national',
}

function resolveAnnuaireAlias(code: AnnuairePlanCode): AnnuairePlanCode {
  return ANNUAIRE_ALIAS_MAP[code] ?? code
}

export function getAnnuairePlan(code: AnnuairePlanCode): AnnuairePlan | undefined {
  const canonical = resolveAnnuaireAlias(code)
  return ANNUAIRE_PLANS.find((plan) => plan.code === canonical)
}

// ════════════════════════════════════════════════════════════════
// 3. BUNDLES — 5 combos cross-sell officiels
// ════════════════════════════════════════════════════════════════

export type BundleCode =
  | 'bundle_solo_starter'
  | 'bundle_solo_performance'
  | 'bundle_solo_regional'
  | 'bundle_cabinet_360'
  | 'bundle_cabinet_national'
  // Alias rétrocompat V3 historique.
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

/**
 * Bundles officiels V5 (refonte mockup 2026-05-25) :
 *
 * | Code                   | Affichage   | Composition                  | Prix | Sépare | Économie |
 * |------------------------|-------------|------------------------------|------|--------|----------|
 * | bundle_solo_starter    | Démarrage   | Présence 19 + Solo 29        | 39 € |  48 €  |   9 €    |
 * | bundle_solo_performance| Croissance  | Boost 39 + Pro 79            | 99 € | 118 €  |  19 €    |
 * | bundle_solo_regional   | Acquisition | Premium 79 + Solo 29         | 89 € | 108 €  |  19 €    |
 * | bundle_cabinet_360     | Cabinet     | Premium 79 + Cabinet 199     | 229€ | 278 €  |  49 €    |
 * | bundle_cabinet_national| Cabinet+    | Premium 79 + Cabinet+ 499 +  | 529€ | 628 €  |  99 €    |
 * |                        |             | 5 communes (slot petite ville × 5)            |
 *
 * Codes internes inchangés pour préserver la rétro-compat des Stripe price IDs
 * existants. Seuls `name`, `tagline`, `monthlyPrice` et la composition (annuaire
 * + logiciel) sont mis à jour.
 */
export const BUNDLES: readonly BundleCombo[] = [
  {
    code: 'bundle_solo_starter',
    name: 'Démarrage',
    tagline: 'Tu démarres et tu veux te faire connaître',
    annuaireComponent: 'annuaire_local',
    logicielComponent: 'solo_light',
    monthlyPrice: 3900,
    annualPrice: annualPriceWithDiscount(3900),
    savingsPerMonth: 900,
    monthlySavingsCents: 900,
    individualMonthlyPriceCents: 4800,
    includedPlanLabels: ['Annuaire Présence 19€', 'KOVAS Solo 29€'],
  },
  {
    code: 'bundle_solo_performance',
    name: 'Croissance',
    tagline: 'Le combo le plus choisi par les diagnostiqueurs en croissance',
    annuaireComponent: 'annuaire_regional',
    logicielComponent: 'solo_pro',
    monthlyPrice: 9900,
    annualPrice: annualPriceWithDiscount(9900),
    savingsPerMonth: 1900,
    monthlySavingsCents: 1900,
    individualMonthlyPriceCents: 11800,
    includedPlanLabels: ['Annuaire Boost 39€', 'KOVAS Pro 79€'],
    featured: true,
  },
  {
    code: 'bundle_solo_regional',
    name: 'Acquisition',
    tagline: 'Pour ceux qui font de l’annuaire leur source n°1 de clients',
    annuaireComponent: 'annuaire_national',
    logicielComponent: 'solo_light',
    monthlyPrice: 8900,
    annualPrice: annualPriceWithDiscount(8900),
    savingsPerMonth: 1900,
    monthlySavingsCents: 1900,
    individualMonthlyPriceCents: 10800,
    includedPlanLabels: ['Annuaire Premium 79€', 'KOVAS Solo 29€'],
  },
  {
    code: 'bundle_cabinet_360',
    name: 'Cabinet',
    tagline: 'L’équipe coordonnée + la visibilité maximale',
    annuaireComponent: 'annuaire_national',
    logicielComponent: 'cabinet',
    monthlyPrice: 22900,
    annualPrice: annualPriceWithDiscount(22900),
    savingsPerMonth: 4900,
    monthlySavingsCents: 4900,
    individualMonthlyPriceCents: 27800,
    includedPlanLabels: ['Annuaire Premium 79€', 'KOVAS Cabinet 199€'],
  },
  {
    code: 'bundle_cabinet_national',
    name: 'Cabinet+',
    tagline: 'Le tout-en-un, multi-site, avec Benjamin en accompagnement direct',
    annuaireComponent: 'annuaire_national',
    logicielComponent: 'cabinet_plus',
    monthlyPrice: 52900,
    annualPrice: annualPriceWithDiscount(52900),
    savingsPerMonth: 9900,
    monthlySavingsCents: 9900,
    individualMonthlyPriceCents: 62800,
    includedPlanLabels: [
      'Annuaire Premium 79€',
      'KOVAS Cabinet+ 499€',
      'Mise en avant sur 5 communes',
    ],
  },
] as const

/** Mapping alias bundles V3 → codes officiels V4. */
const BUNDLE_ALIAS_MAP: Readonly<Record<string, BundleCode>> = {
  bundle_starter_visibility: 'bundle_solo_starter',
  bundle_active_pro: 'bundle_solo_performance',
  bundle_active_visibility: 'bundle_solo_regional',
  bundle_cabinet_pro: 'bundle_cabinet_360',
  bundle_cabinet_visibility: 'bundle_cabinet_360',
}

function resolveBundleAlias(code: BundleCode): BundleCode {
  return BUNDLE_ALIAS_MAP[code] ?? code
}

export function getBundle(code: BundleCode): BundleCombo | undefined {
  const canonical = resolveBundleAlias(code)
  return BUNDLES.find((bundle) => bundle.code === canonical)
}

export function getBundleSavings(code: BundleCode): number {
  return getBundle(code)?.savingsPerMonth ?? 0
}

// ════════════════════════════════════════════════════════════════
// 4. SPONSORED SLOTS — 6 paliers par tranche ville (grille officielle)
// ════════════════════════════════════════════════════════════════

/**
 * Catégories officielles (grille 2026-05-22) :
 *
 * | Catégorie       | Population         | Prix HT/mo |
 * |-----------------|--------------------|------------|
 * | megapole        | > 1 000 000        | 149 €      |
 * | metropole       | 500k - 1M          | 99 €       |
 * | grande_ville    | 100k - 500k        | 69 €       |
 * | ville_moyenne   | 30k - 100k         | 39 €       |
 * | petite_ville    | 10k - 30k          | 19 €       |
 * | commune         | < 10 000           | 9 €        |
 */
export type SponsoredSlotCategory =
  | 'megapole'
  | 'metropole'
  | 'grande_ville'
  | 'ville_moyenne'
  | 'petite_ville'
  | 'commune'
  // Alias rétrocompat V3 (ancien palier rural).
  | 'rural'

export interface SponsoredSlotTier {
  readonly category: SponsoredSlotCategory
  readonly label: string
  readonly populationMin: number
  readonly populationMax: number | null // null = pas de borne haute
  readonly monthlyPrice: number // centimes HT
  readonly annualPrice: number // centimes HT (engagement annuel -15%)
}

export const SPONSORED_SLOT_TIERS: readonly SponsoredSlotTier[] = [
  {
    category: 'megapole',
    label: 'Mégapole (> 1M hab.)',
    populationMin: 1_000_000,
    populationMax: null,
    monthlyPrice: 14900,
    annualPrice: annualPriceWithDiscount(14900),
  },
  {
    category: 'metropole',
    label: 'Métropole (500k-1M hab.)',
    populationMin: 500_000,
    populationMax: 1_000_000,
    monthlyPrice: 9900,
    annualPrice: annualPriceWithDiscount(9900),
  },
  {
    category: 'grande_ville',
    label: 'Grande ville (100k-500k)',
    populationMin: 100_000,
    populationMax: 500_000,
    monthlyPrice: 6900,
    annualPrice: annualPriceWithDiscount(6900),
  },
  {
    category: 'ville_moyenne',
    label: 'Ville moyenne (30k-100k)',
    populationMin: 30_000,
    populationMax: 100_000,
    monthlyPrice: 3900,
    annualPrice: annualPriceWithDiscount(3900),
  },
  {
    category: 'petite_ville',
    label: 'Petite ville (10k-30k)',
    populationMin: 10_000,
    populationMax: 30_000,
    monthlyPrice: 1900,
    annualPrice: annualPriceWithDiscount(1900),
  },
  {
    category: 'commune',
    label: 'Commune (< 10k)',
    populationMin: 0,
    populationMax: 10_000,
    monthlyPrice: 900,
    annualPrice: annualPriceWithDiscount(900),
  },
] as const

const SPONSORED_ALIAS_MAP: Readonly<Record<string, SponsoredSlotCategory>> = {
  rural: 'commune',
}

function resolveSponsoredAlias(category: SponsoredSlotCategory): SponsoredSlotCategory {
  return SPONSORED_ALIAS_MAP[category] ?? category
}

export function getSponsoredSlotTier(
  category: SponsoredSlotCategory,
): SponsoredSlotTier | undefined {
  const canonical = resolveSponsoredAlias(category)
  return SPONSORED_SLOT_TIERS.find((tier) => tier.category === canonical)
}

/** Retourne le palier matchant une population donnée (hab.). */
export function findSponsoredSlotForPopulation(population: number): SponsoredSlotTier | undefined {
  return SPONSORED_SLOT_TIERS.find((tier) => {
    if (population < tier.populationMin) return false
    if (tier.populationMax === null) return true
    return population < tier.populationMax
  })
}

// ════════════════════════════════════════════════════════════════
// 5. ADD-ONS V4 — 4 modules optionnels (grille officielle)
// ════════════════════════════════════════════════════════════════

/**
 * Codes d'add-ons reconnus côté SaaS.
 *
 * V4 grille officielle 2026-05-22 :
 *   - addon_extra_user        : 19€/mo/user · Cabinet+ et Cabinet · max 7
 *   - addon_ia_volume         : 19€/mo · Solo Pro et + (capacité Whisper/Vision étendue)
 *   - addon_conformite_avancee : 39€/mo · Solo Pro et + (Factur-X PPF, Cockpit ADEME M2)
 *   - addon_international     : 25€/mo (rapports bilingues FR/EN, multi-devise)
 *
 * Codes legacy V3 conservés en union (référencés par UPSELL_CATALOG,
 * behavioral-triggers, sidebar, mobile-more-sheet) :
 *   - `addon_signatures_eidas` · `addon_pennylane_sync`
 *   - `addon_sms_reminders` · `addon_community_pro`
 *   - bilingual_reports / facturx_ppf / analytics_advanced / regulatory_watch / cockpit_ademe_m2
 */
export type AddonCode =
  // V4 — grille officielle (présents dans ADDON_MODULES)
  | 'addon_extra_user'
  | 'addon_ia_volume'
  | 'addon_conformite_avancee'
  | 'addon_international'
  // V3 historiques (présents dans ADDON_MODULES — préservés)
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

/** Sous-ensemble strict des 4 codes V4 officiels (pour les writes Stripe / DB). */
export type AddonCodeV4 =
  | 'addon_extra_user'
  | 'addon_ia_volume'
  | 'addon_conformite_avancee'
  | 'addon_international'

/** @deprecated alias V3 historique — utiliser AddonCodeV4. */
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
  readonly overageUnit: string | null // 'sig' / 'SMS' / 'user' / etc.
  /** Plans dans lesquels l'addon est inclus de base (LogicielPlanCode + legacy). */
  readonly includedInPlans: readonly PricingPlanCode[]
  readonly trialDays: number
}

export const ADDON_MODULES: readonly AddonModule[] = [
  {
    code: 'addon_extra_user',
    name: 'Utilisateur supplémentaire',
    description: 'Ajouter un utilisateur au plan Cabinet ou Cabinet+ (jusqu’à 7 max)',
    monthlyPrice: 1900,
    includedQuantity: 1,
    overagePrice: null,
    overageUnit: 'user',
    includedInPlans: [],
    trialDays: 0,
  },
  {
    code: 'addon_ia_volume',
    name: 'Volume IA et Vocal',
    description: 'Capacité Whisper + Vision IA étendue (réservé Solo Pro et +)',
    monthlyPrice: 1900,
    includedQuantity: null,
    overagePrice: null,
    overageUnit: null,
    includedInPlans: [],
    trialDays: 14,
  },
  {
    code: 'addon_conformite_avancee',
    name: 'Pack Conformité Avancée',
    description:
      'Factur-X PPF + Cockpit ADEME M2 + signatures eIDAS incluses (réservé Solo Pro et +)',
    monthlyPrice: 3900,
    includedQuantity: null,
    overagePrice: null,
    overageUnit: null,
    includedInPlans: [],
    trialDays: 14,
  },
  {
    code: 'addon_international',
    name: 'Pack International',
    description: 'Rapports bilingues FR/EN + multi-devise + zones géographiques étendues',
    monthlyPrice: 2500,
    includedQuantity: null,
    overagePrice: null,
    overageUnit: null,
    includedInPlans: [],
    trialDays: 14,
  },
  // ── V3 historiques conservés pour rétro-compat ──────────────────
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

/** Alias plus court / explicite côté code applicatif. */
export const ADDONS = ADDON_MODULES

export function getAddon(code: AddonCode): AddonModule | undefined {
  return ADDON_MODULES.find((addon) => addon.code === code)
}

// ════════════════════════════════════════════════════════════════
// 6. PRICING_PLANS — vue unifiée + rétro-compat legacy E2c
// ════════════════════════════════════════════════════════════════

/** Ancien grille E2c 5-tiers (display publique). Référencé par 50+ composants. */
export type LegacyPlanCode = 'essential' | 'decouverte' | 'pro' | 'all_inclusive'

/** Codes grandfather (suffixe `_legacy`) — prix historiques préservés. */
export type GrandfatherPlanCode =
  | 'essential_legacy'
  | 'decouverte_legacy'
  | 'pro_legacy'
  | 'all_inclusive_legacy'
  | 'cabinet_legacy'
  | 'volume_legacy'
  | 'standard_legacy'
  | 'founder_legacy'

/**
 * Union élargie des codes plan reconnus côté SaaS.
 *
 * Comprend :
 *   - 5 codes V4 officiels (essai / solo_light / solo_pro / cabinet / cabinet_plus)
 *   - 5 codes V3 aliasés (logiciel_free / logiciel_starter / logiciel_active / logiciel_cabinet / logiciel_enterprise)
 *   - 4 codes legacy E2c (essential / decouverte / pro / all_inclusive — `cabinet` est officiel)
 *   - 8 codes grandfather (suffixe `_legacy`)
 *
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
  readonly annualPrice: number // centimes HT (engagement annuel -15%)
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
 * Mapping (cf. CLAUDE.md §4 — Plans grandfather rétrocompat) :
 *   - decouverte_legacy  : 29 € (20 missions + surplus 2 €) → caps Solo Light
 *   - standard_legacy    : 59 € (60 missions + surplus 1,50 €) → caps Solo Pro
 *   - volume_legacy      : 99 € (150 missions + surplus 1 €) → caps Solo Pro étendu
 *   - founder_legacy     : 49 € à vie (70 missions + surplus 1 €) → caps Solo Pro
 *   - cabinet_legacy     : 199 € (400 missions + surplus 0,80 €) → caps Cabinet
 *   - essential_legacy   : 19 € → caps Solo Light
 *   - pro_legacy         : 39 € → caps Solo Pro
 *   - all_inclusive_legacy : 99 € → caps Solo Pro / Cabinet
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
    code: 'standard_legacy',
    name: 'Standard (héritage)',
    tagline: 'Plan E2c grandfather — 59 € / 60 missions / surplus 1,50 €',
    monthlyPrice: 5900,
    annualPrice: 59000,
    caps: {
      missions: 60,
      whisperSeconds: 10 * SECONDS_PER_HOUR,
      visionCalls: 0,
      storageGb: 25,
      users: 1,
    },
    features: ['Plan grandfather — 59 €/mo, 60 missions, surplus 1,50 €/mission'],
  },
  {
    code: 'volume_legacy',
    name: 'Volume (héritage)',
    tagline: 'Plan E2c grandfather — 99 € / 150 missions / surplus 1 €',
    monthlyPrice: 9900,
    annualPrice: 99000,
    caps: {
      missions: 150,
      whisperSeconds: 20 * SECONDS_PER_HOUR,
      visionCalls: 100,
      storageGb: 50,
      users: 1,
    },
    features: ['Plan grandfather — 99 €/mo, 150 missions, surplus 1 €/mission'],
  },
  {
    code: 'founder_legacy',
    name: 'Founder à vie',
    tagline: 'Plan bêta-testeur founder — 49 € / 70 missions / surplus 1 €',
    monthlyPrice: 4900,
    annualPrice: 49000,
    caps: {
      missions: 70,
      whisperSeconds: 10 * SECONDS_PER_HOUR,
      visionCalls: 50,
      storageGb: 25,
      users: 1,
    },
    features: ['Founder à vie — 49 €/mo, 70 missions, surplus 1 €/mission'],
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
    tagline: 'Plan E2c grandfather — 199 € / 400 missions / surplus 0,80 €',
    monthlyPrice: 19900,
    annualPrice: 199000,
    caps: {
      missions: 400,
      whisperSeconds: 40 * SECONDS_PER_HOUR,
      visionCalls: 600,
      storageGb: 100,
      users: 3,
    },
    features: ['Plan grandfather — 199 €/mo, 400 missions, surplus 0,80 €/mission'],
  },
] as const

/**
 * PRICING_PLANS — alias rétro-compat pour itération.
 *
 * Composition : 5 plans V4 logiciel officiels + 5 plans grandfather.
 * Les composants /pricing publics doivent filtrer hors `*_legacy` pour
 * n'afficher que les plans officiels.
 */
export const PRICING_PLANS: readonly PricingPlan[] = [...LOGICIEL_PLANS, ...LEGACY_PLANS] as const

export function getPricingPlan(code: PricingPlanCode): PricingPlan | undefined {
  // Résout alias V3 logiciel et legacy E2c.
  const aliasResolved = (LOGICIEL_ALIAS_MAP[code] ?? code) as PricingPlanCode
  return PRICING_PLANS.find((plan) => plan.code === aliasResolved)
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
const LEGACY_PLAN_CODES = new Set<string>(['essential', 'decouverte', 'pro', 'all_inclusive'])

const GRANDFATHER_PLAN_CODES = new Set<string>([
  'essential_legacy',
  'decouverte_legacy',
  'pro_legacy',
  'all_inclusive_legacy',
  'cabinet_legacy',
  'volume_legacy',
  'standard_legacy',
  'founder_legacy',
])

export function isLegacyPlan(code: string | null | undefined): code is LegacyPlanCode {
  if (!code) return false
  return LEGACY_PLAN_CODES.has(code)
}

export function isGrandfatherPlan(code: string | null | undefined): code is GrandfatherPlanCode {
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
 * Couvre TOUS les codes plan reconnus afin de satisfaire `Record<PricingPlanCode, ...>`
 * exhaustif. Les composants /pricing publics filtrent généralement aux 5
 * codes V4 officiels — les codes legacy / grandfather sont là pour la cohérence type.
 */
export interface FeatureRow {
  readonly category: string
  readonly feature: string
  readonly plans: Record<PricingPlanCode, boolean | string>
}

/** Helper interne pour construire une ligne de la matrice avec mapping legacy → V4. */
function buildFeatureRow(
  category: string,
  feature: string,
  values: {
    readonly essai: boolean | string
    readonly solo_light: boolean | string
    readonly solo_pro: boolean | string
    readonly cabinet: boolean | string
    readonly cabinet_plus: boolean | string
  },
): FeatureRow {
  // Mapping logique : alias V3, legacy E2c et grandfather pointent vers le V4 le plus
  // proche (essential / decouverte_legacy → solo_light, pro → solo_pro, etc.).
  return {
    category,
    feature,
    plans: {
      // V4 officiels
      essai: values.essai,
      solo_light: values.solo_light,
      solo_pro: values.solo_pro,
      cabinet: values.cabinet,
      cabinet_plus: values.cabinet_plus,
      // Alias V3 logiciel
      logiciel_free: values.essai,
      logiciel_starter: values.solo_light,
      logiciel_active: values.solo_pro,
      logiciel_cabinet: values.cabinet,
      logiciel_enterprise: values.cabinet_plus,
      // Legacy E2c (display publique encore référencée)
      essential: values.solo_light,
      decouverte: values.solo_light,
      pro: values.solo_pro,
      all_inclusive: values.solo_pro,
      // Grandfather (back-office)
      essential_legacy: values.solo_light,
      decouverte_legacy: values.solo_light,
      pro_legacy: values.solo_pro,
      standard_legacy: values.solo_pro,
      volume_legacy: values.solo_pro,
      founder_legacy: values.solo_pro,
      all_inclusive_legacy: values.cabinet,
      cabinet_legacy: values.cabinet,
    },
  }
}

export const FEATURE_MATRIX: readonly FeatureRow[] = [
  buildFeatureRow(
    'Diagnostics',
    '8 diagnostics standards (DPE / Amiante / Plomb / Gaz / Élec / Termites / Carrez / ERP)',
    {
      essai: true,
      solo_light: true,
      solo_pro: true,
      cabinet: true,
      cabinet_plus: true,
    },
  ),
  buildFeatureRow('IA', 'Saisie vocale Whisper', {
    essai: '1h essai',
    solo_light: '5h/mo',
    solo_pro: '10h/mo',
    cabinet: '40h/mo',
    cabinet_plus: '80h/mo',
  }),
  buildFeatureRow('IA', 'Vision IA reconnaissance équipements', {
    essai: false,
    solo_light: false,
    solo_pro: '100/mo',
    cabinet: '600/mo',
    cabinet_plus: '1 500/mo',
  }),
  buildFeatureRow('Stockage', 'Capacité cloud', {
    essai: '5 Go',
    solo_light: '12 Go',
    solo_pro: '25 Go',
    cabinet: '100 Go',
    cabinet_plus: '250 Go',
  }),
  buildFeatureRow('Comptes', "Nombre d'utilisateurs", {
    essai: '1',
    solo_light: '1',
    solo_pro: '1',
    cabinet: '3',
    cabinet_plus: '7',
  }),
  buildFeatureRow('Devis & Factures', 'Module Devis + Factures Factur-X', {
    essai: false,
    solo_light: true,
    solo_pro: true,
    cabinet: true,
    cabinet_plus: true,
  }),
  buildFeatureRow('Annuaire', 'Niveau de fiche annuaire (track séparé)', {
    essai: 'Vérifié',
    solo_light: 'Vérifié',
    solo_pro: 'Premium',
    cabinet: 'Premium',
    cabinet_plus: 'Premium',
  }),
  buildFeatureRow('Support', 'Support email', {
    essai: '48h',
    solo_light: '48h',
    solo_pro: '24h',
    cabinet: '12h',
    cabinet_plus: '4h SLA',
  }),
] as const

// ════════════════════════════════════════════════════════════════
// 9. ALIAS & HELPERS DE COMPATIBILITÉ (B3 UI dependencies)
// ════════════════════════════════════════════════════════════════

/** Alias court de BundleCombo — utilisé par les composants UI (B3). */
export type Bundle = BundleCombo

/**
 * Mapping d'un plan E2c legacy vers son équivalent V4 grandfather + suggéré.
 * Utilisé par `LegacyGrandfatherBanner` pour afficher le passage.
 */
export interface LegacyPlanMapping {
  readonly legacyDisplayName: string
  readonly grandfatherCode: GrandfatherPlanCode
  readonly grandfatherMonthlyPriceCents: number
  readonly suggestedNewPlanCode: LogicielPlanCode
}

/**
 * LEGACY_PLAN_MAP — mapping ancien code public → nouveau plan officiel.
 *
 * Référence utilisateur (grille 2026-05-22) :
 *   - `essential`     (9€)    → `solo_light`   (29€)
 *   - `decouverte`    (19€)   → `solo_light`   (29€)
 *   - `pro`           (35€)   → `solo_pro`     (59€)
 *   - `all_inclusive` (49€)   → `cabinet`      (149€)
 *   - `volume_legacy` (99€)   → `cabinet`      (149€)
 *   - `cabinet`       (89€)   → `cabinet_plus` (299€)
 *
 * Note : on conserve `cabinet` côté code (le nom est officiel V4 pour 149€)
 * mais les anciens abonnements `cabinet` à 89€ migrent vers `cabinet_plus`.
 * Le discriminant prix se fait via `subscription.plan_code` au moment de
 * la migration de tier (cf. `LEGACY_PLAN_MAPPING`).
 */
export const LEGACY_PLAN_MAP: Readonly<Record<LegacyPlanCode, LogicielPlanCode>> = {
  essential: 'solo_light',
  decouverte: 'solo_light',
  pro: 'solo_pro',
  all_inclusive: 'cabinet',
}

const LEGACY_PLAN_MAPPING: Readonly<Record<LegacyPlanCode, LegacyPlanMapping>> = {
  essential: {
    legacyDisplayName: 'Essential (héritage)',
    grandfatherCode: 'essential_legacy',
    grandfatherMonthlyPriceCents: 1900,
    suggestedNewPlanCode: 'solo_light',
  },
  decouverte: {
    legacyDisplayName: 'Découverte (héritage)',
    grandfatherCode: 'decouverte_legacy',
    grandfatherMonthlyPriceCents: 2900,
    suggestedNewPlanCode: 'solo_light',
  },
  pro: {
    legacyDisplayName: 'Pro (héritage)',
    grandfatherCode: 'pro_legacy',
    grandfatherMonthlyPriceCents: 3900,
    suggestedNewPlanCode: 'solo_pro',
  },
  all_inclusive: {
    legacyDisplayName: 'All Inclusive (héritage)',
    grandfatherCode: 'all_inclusive_legacy',
    grandfatherMonthlyPriceCents: 9900,
    suggestedNewPlanCode: 'cabinet',
  },
}

/** Récupère le mapping legacy → V4 grandfather pour un plan E2c historique. */
export function getLegacyPlanMapping(code: LegacyPlanCode): LegacyPlanMapping {
  return LEGACY_PLAN_MAPPING[code]
}
