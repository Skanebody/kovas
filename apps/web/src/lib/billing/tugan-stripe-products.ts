/**
 * KOVAS — Configuration des 21 produits Stripe Tugan v3.0
 *
 * Module TypeScript pur (sans dépendance Stripe SDK) qui décrit la matrice
 * exhaustive des produits à provisionner dans Stripe pour le tunnel Tugan v3.0.
 *
 * Inventaire des 21 produits :
 *   - 8 plans logiciel : 4 tiers (Solo / Pro / Cabinet / Cabinet+) × 2 cycles
 *     (monthly / annual). L'annuel = 12 × monthly × 0,85 (engagement -15%).
 *   - 2 one-time : Audit Rétrospectif IA (99 €) + Lifetime Deal Partenaire
 *     Fondateur (2 000 € → active 3 ans Cabinet automatique via webhook).
 *   - 7 add-ons mensuels : premium_reports / pipeline_maprimerenov /
 *     bouclier_conformite / observatoire_local / auto_reponse_avis /
 *     newsletter_clients / cockpit_cabinet (exclusif Cabinet+).
 *   - 4 bundles mensuels d'add-ons : productivite_essentielle / acquisition /
 *     pro_complet / cabinet_premium (exclusif Cabinet+).
 *
 * Conventions strictes (cf. CLAUDE.md §10) :
 *   - Tous les `priceCents` en centimes integer (jamais float, jamais string).
 *   - Annual = round(monthly * 12 * 0.85) — engagement annuel -15%.
 *   - `stripePriceLookupKey` = `kovas_<code>` pour récupération via
 *     `stripe.prices.list({ lookup_keys: [...] })`.
 *   - `description` courte (1 ligne) pour affichage dashboard Stripe + factures.
 *
 * Ce module est consommé par :
 *   - `scripts/seed-stripe-products.ts` (provisioning idempotent Stripe).
 *   - tests unitaires garantissant invariants (`__tests__/tugan-stripe-products.test.ts`).
 *
 * Ne PAS confondre avec `src/lib/pricing/stripe-products.ts` qui mappe les
 * Stripe Price IDs runtime (env vars). Ce fichier-ci décrit la config produit
 * source de vérité ; l'autre lit les IDs runtime après provisioning.
 */

// ════════════════════════════════════════════════════════════════
// Types publics
// ════════════════════════════════════════════════════════════════

export type StripeProductCode =
  // 8 plans logiciel (4 tiers × 2 cycles)
  | 'plan_solo_monthly'
  | 'plan_solo_annual'
  | 'plan_pro_monthly'
  | 'plan_pro_annual'
  | 'plan_cabinet_monthly'
  | 'plan_cabinet_annual'
  | 'plan_cabinet_plus_monthly'
  | 'plan_cabinet_plus_annual'
  // 2 one-time
  | 'audit_retroactif_oneshot'
  | 'lifetime_deal_founder'
  // 7 add-ons mensuels
  | 'addon_premium_reports'
  | 'addon_pipeline_maprimerenov'
  | 'addon_bouclier_conformite'
  | 'addon_observatoire_local'
  | 'addon_auto_reponse_avis'
  | 'addon_newsletter_clients'
  | 'addon_cockpit_cabinet'
  // 4 bundles mensuels d'add-ons
  | 'bundle_productivite_essentielle'
  | 'bundle_acquisition'
  | 'bundle_pro_complet'
  | 'bundle_cabinet_premium'

export interface StripeProductConfig {
  /** Code interne unique (réutilisé en metadata Stripe + lookup_key suffix). */
  readonly code: StripeProductCode
  /** Nom affiché dans Stripe dashboard + factures clients. */
  readonly stripeProductName: string
  /** Lookup key Stripe : `kovas_<code>` (récupération via prices.list). */
  readonly stripePriceLookupKey: string
  /** Prix en centimes integer (jamais float). */
  readonly priceCents: number
  /** Devise — toujours EUR (KOVAS = marché FR Phase 1). */
  readonly currency: 'eur'
  /** Mode de facturation Stripe. */
  readonly billingMode: 'monthly_subscription' | 'annual_subscription' | 'one_time'
  /** Période d'essai (0 = pas d'essai, 7 = add-on, 30 = plan principal). */
  readonly trialDays: number
  /**
   * Plans dans lesquels ce produit est inclus de base (pour les add-ons
   * qui pourraient devenir natifs d'un tier supérieur). Vide en V1 Tugan.
   */
  readonly includedInPlans?: readonly string[]
  /**
   * Tier minimum requis pour souscrire à cet add-on / bundle.
   * Ex: `addon_cockpit_cabinet` et `bundle_cabinet_premium` = `cabinet_plus`.
   */
  readonly requiredTierAtLeast?: string
  /** Catégorie produit pour filtrage UI / scripts. */
  readonly category: 'plan' | 'addon' | 'bundle' | 'oneshot'
  /** Description courte (1 ligne, dashboard Stripe + factures). */
  readonly description: string
}

// ════════════════════════════════════════════════════════════════
// Helpers internes (calcul annuel -15%)
// ════════════════════════════════════════════════════════════════

/**
 * Calcule le prix annuel HT (centimes) avec engagement annuel -15%.
 * Formule : round(monthlyCents × 12 × 0,85).
 *
 * Exemples vérifiés :
 *   -  29 €/mo → 295,80 €/an (29 600 cts)
 *   -  79 €/mo → 805,80 €/an (80 580 cts)
 *   - 199 €/mo → 2 029,80 €/an (202 980 cts)
 *   - 499 €/mo → 5 089,80 €/an (508 980 cts)
 */
function annualPriceFromMonthly(monthlyCents: number): number {
  return Math.round(monthlyCents * 12 * 0.85)
}

/** Construit un lookup_key Stripe stable : `kovas_<code>`. */
function lookupKey(code: StripeProductCode): string {
  return `kovas_${code}`
}

// ════════════════════════════════════════════════════════════════
// Catalogue exhaustif — 21 produits Tugan v3.0
// ════════════════════════════════════════════════════════════════

/**
 * Liste exhaustive et figée des 21 produits Stripe à provisionner.
 *
 * Ordre logique : plans (monthly puis annual par tier), one-time, add-ons,
 * bundles. Cet ordre est conservé pour faciliter la lecture du dashboard
 * Stripe après seed.
 */
export const TUGAN_STRIPE_PRODUCTS: readonly StripeProductConfig[] = [
  // ── Plans logiciel — 4 tiers × 2 cycles = 8 produits ──────────────
  {
    code: 'plan_solo_monthly',
    stripeProductName: 'KOVAS Solo (mensuel)',
    stripePriceLookupKey: lookupKey('plan_solo_monthly'),
    priceCents: 2900, // 29 €
    currency: 'eur',
    billingMode: 'monthly_subscription',
    trialDays: 30,
    category: 'plan',
    description: 'Tu démarres ou tu fais environ 10 missions par semaine — 40 missions / mois',
  },
  {
    code: 'plan_solo_annual',
    stripeProductName: 'KOVAS Solo (annuel)',
    stripePriceLookupKey: lookupKey('plan_solo_annual'),
    priceCents: annualPriceFromMonthly(2900), // 29 580 cts = 295,80 €
    currency: 'eur',
    billingMode: 'annual_subscription',
    trialDays: 30,
    category: 'plan',
    description: 'KOVAS Solo annuel — engagement 12 mois, économie -15%',
  },
  {
    code: 'plan_pro_monthly',
    stripeProductName: 'KOVAS Pro (mensuel)',
    stripePriceLookupKey: lookupKey('plan_pro_monthly'),
    priceCents: 7900, // 79 €
    currency: 'eur',
    billingMode: 'monthly_subscription',
    trialDays: 30,
    category: 'plan',
    description: 'Tu travailles à temps plein, 15 à 25 missions par semaine — 100 missions / mois',
  },
  {
    code: 'plan_pro_annual',
    stripeProductName: 'KOVAS Pro (annuel)',
    stripePriceLookupKey: lookupKey('plan_pro_annual'),
    priceCents: annualPriceFromMonthly(7900), // 80 580 cts = 805,80 €
    currency: 'eur',
    billingMode: 'annual_subscription',
    trialDays: 30,
    category: 'plan',
    description: 'KOVAS Pro annuel — engagement 12 mois, économie -15%',
  },
  {
    code: 'plan_cabinet_monthly',
    stripeProductName: 'KOVAS Cabinet (mensuel)',
    stripePriceLookupKey: lookupKey('plan_cabinet_monthly'),
    priceCents: 19900, // 199 €
    currency: 'eur',
    billingMode: 'monthly_subscription',
    trialDays: 30,
    category: 'plan',
    description: 'Tu travailles en équipe de 2 à 5 personnes — 300 missions / mois, 5 utilisateurs',
  },
  {
    code: 'plan_cabinet_annual',
    stripeProductName: 'KOVAS Cabinet (annuel)',
    stripePriceLookupKey: lookupKey('plan_cabinet_annual'),
    priceCents: annualPriceFromMonthly(19900), // 202 980 cts = 2 029,80 €
    currency: 'eur',
    billingMode: 'annual_subscription',
    trialDays: 30,
    category: 'plan',
    description: 'KOVAS Cabinet annuel — engagement 12 mois, économie -15%',
  },
  {
    code: 'plan_cabinet_plus_monthly',
    stripeProductName: 'KOVAS Cabinet+ (mensuel)',
    stripePriceLookupKey: lookupKey('plan_cabinet_plus_monthly'),
    priceCents: 49900, // 499 €
    currency: 'eur',
    billingMode: 'monthly_subscription',
    trialDays: 30,
    category: 'plan',
    description: 'Tu pilotes 6 à 15 personnes, multi-site — 1000 missions / mois, 15 utilisateurs',
  },
  {
    code: 'plan_cabinet_plus_annual',
    stripeProductName: 'KOVAS Cabinet+ (annuel)',
    stripePriceLookupKey: lookupKey('plan_cabinet_plus_annual'),
    priceCents: annualPriceFromMonthly(49900), // 508 980 cts = 5 089,80 €
    currency: 'eur',
    billingMode: 'annual_subscription',
    trialDays: 30,
    category: 'plan',
    description: 'KOVAS Cabinet+ annuel — engagement 12 mois, économie -15%',
  },

  // ── One-time products — 2 produits ────────────────────────────────
  {
    code: 'audit_retroactif_oneshot',
    stripeProductName: 'Audit Rétrospectif IA',
    stripePriceLookupKey: lookupKey('audit_retroactif_oneshot'),
    priceCents: 9900, // 99 €
    currency: 'eur',
    billingMode: 'one_time',
    trialDays: 0,
    category: 'oneshot',
    description:
      'Analyse rétrospective de tes 12 derniers mois de missions — diagnostic chiffré sous 48h',
  },
  {
    code: 'lifetime_deal_founder',
    stripeProductName: 'Lifetime Deal Partenaire Fondateur',
    stripePriceLookupKey: lookupKey('lifetime_deal_founder'),
    priceCents: 200_000, // 2 000 €
    currency: 'eur',
    billingMode: 'one_time',
    trialDays: 0,
    category: 'oneshot',
    description:
      'Offre fondateur scarce H1 2026 — 3 ans Cabinet inclus + influence roadmap + DM Benjamin',
  },

  // ── Add-ons mensuels — 7 produits ─────────────────────────────────
  {
    code: 'addon_premium_reports',
    stripeProductName: 'Add-on Premium Reports',
    stripePriceLookupKey: lookupKey('addon_premium_reports'),
    priceCents: 1900, // 19 €
    currency: 'eur',
    billingMode: 'monthly_subscription',
    trialDays: 7,
    category: 'addon',
    description: 'Rapports premium personnalisés — branding cabinet, exports avancés',
  },
  {
    code: 'addon_pipeline_maprimerenov',
    stripeProductName: 'Add-on Pipeline MaPrimeRénov',
    stripePriceLookupKey: lookupKey('addon_pipeline_maprimerenov'),
    priceCents: 2900, // 29 €
    currency: 'eur',
    billingMode: 'monthly_subscription',
    trialDays: 7,
    category: 'addon',
    description:
      'Pipeline MaPrimeRénov — détection éligibilité automatique + relance prospects DPE F-G',
  },
  {
    code: 'addon_bouclier_conformite',
    stripeProductName: 'Add-on Bouclier Conformité',
    stripePriceLookupKey: lookupKey('addon_bouclier_conformite'),
    priceCents: 4900, // 49 €
    currency: 'eur',
    billingMode: 'monthly_subscription',
    trialDays: 7,
    category: 'addon',
    description: 'Bouclier conformité — veille réglementaire, alertes anomalies, aide à la défense',
  },
  {
    code: 'addon_observatoire_local',
    stripeProductName: 'Add-on Observatoire Local',
    stripePriceLookupKey: lookupKey('addon_observatoire_local'),
    priceCents: 1900, // 19 €
    currency: 'eur',
    billingMode: 'monthly_subscription',
    trialDays: 7,
    category: 'addon',
    description:
      'Observatoire local — stats marché DPE par commune, benchmark prix concurrents anonymisé',
  },
  {
    code: 'addon_auto_reponse_avis',
    stripeProductName: 'Add-on Auto-Réponse Avis',
    stripePriceLookupKey: lookupKey('addon_auto_reponse_avis'),
    priceCents: 1900, // 19 €
    currency: 'eur',
    billingMode: 'monthly_subscription',
    trialDays: 7,
    category: 'addon',
    description: 'Auto-réponse aux avis Google — suggestions IA contextualisées validées par toi',
  },
  {
    code: 'addon_newsletter_clients',
    stripeProductName: 'Add-on Newsletter Clients',
    stripePriceLookupKey: lookupKey('addon_newsletter_clients'),
    priceCents: 1900, // 19 €
    currency: 'eur',
    billingMode: 'monthly_subscription',
    trialDays: 7,
    category: 'addon',
    description: 'Newsletter clients automatique — entretien lien post-mission, relances annuelles',
  },
  {
    code: 'addon_cockpit_cabinet',
    stripeProductName: 'Add-on Cockpit Cabinet',
    stripePriceLookupKey: lookupKey('addon_cockpit_cabinet'),
    priceCents: 7900, // 79 €
    currency: 'eur',
    billingMode: 'monthly_subscription',
    trialDays: 7,
    requiredTierAtLeast: 'cabinet_plus',
    category: 'addon',
    description:
      'Cockpit Cabinet (Cabinet+ exclusif) — pilotage multi-site, KPI consolidés, alertes équipe',
  },

  // ── Bundles mensuels d'add-ons — 4 produits ───────────────────────
  //
  // Tarification calibrée pour offrir une économie nette vs achat séparé.
  // Bundle Cabinet Premium est exclusif Cabinet+ (inclut Cockpit Cabinet).
  //
  {
    code: 'bundle_productivite_essentielle',
    stripeProductName: 'Bundle Productivité Essentielle',
    stripePriceLookupKey: lookupKey('bundle_productivite_essentielle'),
    priceCents: 4900, // 49 € (vs 4×19 = 76 €, économie 27 €)
    currency: 'eur',
    billingMode: 'monthly_subscription',
    trialDays: 7,
    category: 'bundle',
    description:
      '4 add-ons productivité (Premium Reports + Observatoire + Auto-Réponse + Newsletter) — économie 27 €/mo',
  },
  {
    code: 'bundle_acquisition',
    stripeProductName: 'Bundle Acquisition',
    stripePriceLookupKey: lookupKey('bundle_acquisition'),
    priceCents: 5900, // 59 € (vs Pipeline 29 + 3×19 = 86 €, économie 27 €)
    currency: 'eur',
    billingMode: 'monthly_subscription',
    trialDays: 7,
    category: 'bundle',
    description:
      'Pipeline MaPrimeRénov + 3 add-ons acquisition (Observatoire + Auto-Réponse + Newsletter) — économie 27 €/mo',
  },
  {
    code: 'bundle_pro_complet',
    stripeProductName: 'Bundle Pro Complet',
    stripePriceLookupKey: lookupKey('bundle_pro_complet'),
    priceCents: 10900, // 109 € (vs 6 add-ons à 154 €, économie 45 €)
    currency: 'eur',
    billingMode: 'monthly_subscription',
    trialDays: 7,
    category: 'bundle',
    description:
      '6 add-ons (tous sauf Cockpit Cabinet) — pack complet productivité + acquisition + conformité, économie 45 €/mo',
  },
  {
    code: 'bundle_cabinet_premium',
    stripeProductName: 'Bundle Cabinet Premium',
    stripePriceLookupKey: lookupKey('bundle_cabinet_premium'),
    priceCents: 14900, // 149 € (vs 7 add-ons à 213 €, économie 64 €)
    currency: 'eur',
    billingMode: 'monthly_subscription',
    trialDays: 7,
    requiredTierAtLeast: 'cabinet_plus',
    category: 'bundle',
    description:
      '7 add-ons inclus Cockpit Cabinet (Cabinet+ exclusif) — pack tout-en-un, économie 64 €/mo',
  },
] as const

// ════════════════════════════════════════════════════════════════
// Helpers publics
// ════════════════════════════════════════════════════════════════

/**
 * Retourne la config d'un produit par son code, ou `undefined` si inconnu.
 * Utile pour les routes checkout qui mappent un code reçu en config Stripe.
 */
export function getStripeProduct(code: StripeProductCode): StripeProductConfig | undefined {
  return TUGAN_STRIPE_PRODUCTS.find((product) => product.code === code)
}

/**
 * Retourne tous les produits d'une catégorie donnée.
 * Utile pour rendre les listes UI (page pricing, picker add-ons, etc.).
 */
export function getStripeProductsByCategory(
  category: StripeProductConfig['category'],
): readonly StripeProductConfig[] {
  return TUGAN_STRIPE_PRODUCTS.filter((product) => product.category === category)
}

/**
 * Formatte un montant en centimes vers une chaîne EUR française.
 *
 * Exemples :
 *   - formatPriceEur(7900)   → "79,00 €"
 *   - formatPriceEur(200000) → "2 000,00 €"
 *   - formatPriceEur(99)     → "0,99 €"
 *
 * Utilise Intl.NumberFormat avec locale fr-FR pour le séparateur décimal
 * virgule + séparateur de milliers espace insécable.
 */
export function formatPriceEur(cents: number): string {
  const euros = cents / 100
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(euros)
}
