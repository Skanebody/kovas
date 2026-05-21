/**
 * Builders typés Schema.org JSON-LD pour les pages publiques KOVAS.
 *
 * Centralise la génération des balises structurées (Organization, WebSite,
 * LocalBusiness, Product/Service, Article, BreadcrumbList) consommées par
 * les moteurs de recherche pour enrichir les SERP et alimenter les
 * connaissances tierces (Google Knowledge Graph, Bing, etc.).
 *
 * Toutes les builders puisent dans `COMPANY_IDENTITY` (source de vérité) afin
 * que toute mise à jour SIREN/RCS/adresse se propage automatiquement.
 *
 * Référence : https://schema.org/docs/full.html
 */

import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'
import type {
  AnnuairePlan,
  BundleCombo,
  LogicielPlan,
} from '@/lib/pricing-plans'
import { KOVAS_TIERS, type KovasTier } from '@/lib/stripe-config'

/** URL canonique du site KOVAS (sans slash final). */
export const KOVAS_BASE_URL = 'https://kovas.fr'

// ───────────────────────────────────────────────────────────────────────────
// Types Schema.org (subset utilisé par KOVAS)
// ───────────────────────────────────────────────────────────────────────────

interface SchemaContext {
  readonly '@context'?: 'https://schema.org'
  readonly '@id'?: string
}

export interface PostalAddressSchema extends SchemaContext {
  readonly '@type': 'PostalAddress'
  readonly streetAddress: string
  readonly addressLocality: string
  readonly postalCode: string
  readonly addressCountry: 'FR'
}

export interface PersonSchema extends SchemaContext {
  readonly '@type': 'Person'
  readonly name: string
  readonly jobTitle?: string
  readonly url?: string
}

export interface GeoCoordinatesSchema {
  readonly '@type': 'GeoCoordinates'
  readonly latitude: number
  readonly longitude: number
}

export interface AggregateRatingSchema {
  readonly '@type': 'AggregateRating'
  readonly ratingValue: number
  readonly reviewCount: number
  readonly bestRating?: number
  readonly worstRating?: number
}

export interface BrandSchema {
  readonly '@type': 'Brand'
  readonly name: string
  readonly url?: string
}

export interface OrganizationSchema extends SchemaContext {
  readonly '@type': 'Organization'
  readonly name: string
  readonly legalName: string
  readonly url: string
  readonly logo: string
  readonly sameAs: readonly string[]
  readonly address: PostalAddressSchema
  readonly founder: PersonSchema
  readonly foundingDate: string
  readonly taxID: string
  readonly vatID: string
  readonly email?: string
}

export interface SearchActionSchema {
  readonly '@type': 'SearchAction'
  readonly target: {
    readonly '@type': 'EntryPoint'
    readonly urlTemplate: string
  }
  readonly 'query-input': string
}

export interface WebSiteSchema extends SchemaContext {
  readonly '@type': 'WebSite'
  readonly url: string
  readonly name: string
  readonly description: string
  readonly inLanguage: 'fr-FR'
  readonly publisher: { readonly '@id': string }
  readonly potentialAction?: SearchActionSchema
}

export interface LocalBusinessSchema extends SchemaContext {
  readonly '@type': 'LocalBusiness' | 'ProfessionalService'
  readonly name: string
  readonly description?: string
  readonly url: string
  readonly image?: string
  readonly telephone?: string
  readonly email?: string
  readonly address: PostalAddressSchema
  readonly geo?: GeoCoordinatesSchema
  readonly areaServed?: readonly string[]
  readonly serviceType?: readonly string[]
  readonly aggregateRating?: AggregateRatingSchema
  readonly priceRange?: string
}

export interface UnitPriceSpecificationSchema {
  readonly '@type': 'UnitPriceSpecification'
  readonly price: number
  readonly priceCurrency: 'EUR'
  readonly unitText: 'mois' | 'an'
  readonly referenceQuantity?: {
    readonly '@type': 'QuantitativeValue'
    readonly value: number
    readonly unitCode: 'MON' | 'ANN'
  }
}

export interface OfferSchema extends SchemaContext {
  readonly '@type': 'Offer'
  readonly name?: string
  readonly price: string
  readonly priceCurrency: 'EUR'
  readonly availability: 'https://schema.org/InStock'
  readonly url: string
  readonly priceSpecification?: UnitPriceSpecificationSchema
}

export interface ProductSchema extends SchemaContext {
  readonly '@type': 'Product' | 'Service' | 'SoftwareApplication'
  readonly name: string
  readonly description: string
  readonly brand: BrandSchema
  readonly offers: readonly OfferSchema[]
  readonly applicationCategory?: string
  readonly operatingSystem?: string
}

export interface WebPageRef {
  readonly '@type': 'WebPage'
  readonly '@id': string
}

export interface ArticleSchema extends SchemaContext {
  readonly '@type': 'Article'
  readonly headline: string
  readonly description: string
  readonly image?: readonly string[]
  readonly datePublished: string
  readonly dateModified?: string
  readonly author: PersonSchema | { readonly '@type': 'Organization'; readonly name: string; readonly url?: string }
  readonly publisher: { readonly '@id': string }
  readonly mainEntityOfPage: WebPageRef
  readonly inLanguage: 'fr-FR'
}

export interface BreadcrumbListItem {
  readonly '@type': 'ListItem'
  readonly position: number
  readonly name: string
  readonly item: string
}

export interface BreadcrumbListSchema extends SchemaContext {
  readonly '@type': 'BreadcrumbList'
  readonly itemListElement: readonly BreadcrumbListItem[]
}

export interface ItemListSchema extends SchemaContext {
  readonly '@type': 'ItemList'
  readonly name: string
  readonly itemListElement: ReadonlyArray<{
    readonly '@type': 'ListItem'
    readonly position: number
    readonly item: ProductSchema
  }>
}

// ───────────────────────────────────────────────────────────────────────────
// Builders publics
// ───────────────────────────────────────────────────────────────────────────

/** Construit la balise Organization (éditeur KOVAS = NEXUS 1993). */
export function buildOrganizationSchema(): OrganizationSchema {
  const c = COMPANY_IDENTITY
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${KOVAS_BASE_URL}/#organization`,
    name: c.brands.umbrella,
    legalName: c.legalName,
    url: KOVAS_BASE_URL,
    logo: `${KOVAS_BASE_URL}/icons/icon-192.png`,
    email: c.emails.contactGeneral,
    sameAs: ['https://www.linkedin.com/company/kovas'],
    address: {
      '@type': 'PostalAddress',
      streetAddress: c.address.line1,
      addressLocality: c.address.city,
      postalCode: c.address.postalCode,
      addressCountry: 'FR',
    },
    founder: {
      '@type': 'Person',
      name: c.legalRepresentative.fullName,
      jobTitle: c.legalRepresentative.role,
    },
    foundingDate: c.incorporatedAt,
    taxID: c.sirenFormatted,
    vatID: c.vatIntracom,
  }
}

/**
 * Construit la balise WebSite + SearchAction (action de recherche annuaire).
 * Le SearchAction permet à Google d'afficher une SearchBox dans les SERP.
 */
export function buildWebSiteSchema(): WebSiteSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${KOVAS_BASE_URL}/#website`,
    url: KOVAS_BASE_URL,
    name: COMPANY_IDENTITY.brands.umbrella,
    description:
      "KOVAS — Logiciel et annuaire pour diagnostiqueurs immobiliers indépendants en France.",
    inLanguage: 'fr-FR',
    publisher: { '@id': `${KOVAS_BASE_URL}/#organization` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${KOVAS_BASE_URL}/diagnostiqueurs?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

/** Données brutes d'un diagnostiqueur pour produire un LocalBusiness Schema. */
export interface DiagnosticianForSchema {
  /** Nom complet du diagnostiqueur ou raison sociale */
  readonly fullName: string
  /** Slug URL (utilisé dans `/diagnostiqueurs/[dept]/[city]/[slug]`) */
  readonly slug: string
  /** Ville d'exercice */
  readonly city: string
  /** Code postal */
  readonly postalCode?: string
  /** Code département (ex. "75", "92") */
  readonly dept: string
  /** Adresse ligne 1 si publique */
  readonly streetAddress?: string
  /** Latitude WGS84 */
  readonly geoLat?: number
  /** Longitude WGS84 */
  readonly geoLng?: number
  /** Certifications publiques (ex. "Bureau Veritas DPE", "Apave amiante") */
  readonly certifications?: readonly { readonly type: string }[]
  /** Téléphone E.164 */
  readonly phone?: string
  /** Email public */
  readonly email?: string
  /** URL photo de profil */
  readonly photoUrl?: string
  /** Bio courte */
  readonly bio?: string
  /** Note moyenne (0-5) */
  readonly rating?: number
  /** Nombre d'avis */
  readonly reviewCount?: number
  /** Communes desservies (zones d'intervention) */
  readonly areasServed?: readonly string[]
}

/**
 * Construit la balise LocalBusiness pour une fiche diagnostiqueur publique.
 * Utilise le type `ProfessionalService` qui hérite de LocalBusiness et est
 * sémantiquement plus précis pour un prestataire B2C/B2B de services techniques.
 */
export function buildLocalBusinessSchema(diag: DiagnosticianForSchema): LocalBusinessSchema {
  const url = `${KOVAS_BASE_URL}/diagnostiqueurs/${diag.dept}/${slugify(diag.city)}/${diag.slug}`

  const schema: LocalBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${url}#business`,
    name: diag.fullName,
    description: diag.bio,
    url,
    image: diag.photoUrl,
    telephone: diag.phone,
    email: diag.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: diag.streetAddress ?? diag.city,
      addressLocality: diag.city,
      postalCode: diag.postalCode ?? '',
      addressCountry: 'FR',
    },
    geo:
      typeof diag.geoLat === 'number' && typeof diag.geoLng === 'number'
        ? { '@type': 'GeoCoordinates', latitude: diag.geoLat, longitude: diag.geoLng }
        : undefined,
    areaServed: diag.areasServed,
    serviceType: diag.certifications?.map((c) => c.type),
    aggregateRating:
      typeof diag.rating === 'number' && typeof diag.reviewCount === 'number' && diag.reviewCount > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: diag.rating,
            reviewCount: diag.reviewCount,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
    priceRange: '€€',
  }

  return schema
}

/**
 * Construit la balise Product (en réalité SoftwareApplication pour un SaaS)
 * pour un plan tarifaire KOVAS — Phase 1, 3 tiers (Découverte/Standard/Volume).
 */
export function buildProductSchema(plan: KovasTier): ProductSchema {
  const offerUrl = `${KOVAS_BASE_URL}/pricing#${plan.id}`
  const monthlyPriceEur = (plan.priceMonthlyCents / 100).toFixed(2)
  const annualPriceEur = (plan.priceAnnualCents / 100).toFixed(2)

  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    '@id': `${KOVAS_BASE_URL}/pricing#${plan.id}-product`,
    name: `${COMPANY_IDENTITY.brands.umbrella} ${plan.label}`,
    description: plan.description,
    brand: {
      '@type': 'Brand',
      name: COMPANY_IDENTITY.brands.umbrella,
      url: KOVAS_BASE_URL,
    },
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android (PWA)',
    offers: [
      {
        '@type': 'Offer',
        name: `${plan.label} — Mensuel`,
        price: monthlyPriceEur,
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        url: offerUrl,
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: Number(monthlyPriceEur),
          priceCurrency: 'EUR',
          unitText: 'mois',
          referenceQuantity: {
            '@type': 'QuantitativeValue',
            value: 1,
            unitCode: 'MON',
          },
        },
      },
      {
        '@type': 'Offer',
        name: `${plan.label} — Annuel (2 mois offerts)`,
        price: annualPriceEur,
        priceCurrency: 'EUR',
        availability: 'https://schema.org/InStock',
        url: offerUrl,
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: Number(annualPriceEur),
          priceCurrency: 'EUR',
          unitText: 'an',
          referenceQuantity: {
            '@type': 'QuantitativeValue',
            value: 1,
            unitCode: 'ANN',
          },
        },
      },
    ],
  }
}

/** Construit la liste itémisée des plans tarifaires KOVAS (legacy 3 tiers). */
export function buildLegacyPricingItemListSchema(): ItemListSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Forfaits ${COMPANY_IDENTITY.brands.umbrella}`,
    itemListElement: KOVAS_TIERS.map((plan, idx) => ({
      '@type': 'ListItem' as const,
      position: idx + 1,
      item: buildProductSchema(plan),
    })),
  }
}

/** Données minimales d'un plan tarifaire V3 (Annuaire / Logiciel / Bundle). */
export interface V3PlanForSchema {
  readonly code: string
  readonly name: string
  readonly tagline: string
  /** Prix mensuel en centimes HT. */
  readonly monthlyPrice: number
  /** Prix annuel en centimes HT. */
  readonly annualPrice: number
}

/**
 * Construit la balise Service Schema.org pour un plan V3 (Annuaire / Logiciel / Bundle).
 *
 * On utilise le type `Service` plutôt que `SoftwareApplication` parce qu'il
 * englobe à la fois l'annuaire (service de mise en relation B2C) et le SaaS
 * logiciel B2B, sans contraindre la nature applicative.
 */
export function buildV3ServiceSchema(
  plan: V3PlanForSchema,
  pricingAnchor: string,
): ProductSchema {
  const offerUrl = `${KOVAS_BASE_URL}/pricing${pricingAnchor}`
  const monthlyPriceEur = (plan.monthlyPrice / 100).toFixed(2)
  const annualPriceEur = (plan.annualPrice / 100).toFixed(2)

  const offers: OfferSchema[] = [
    {
      '@type': 'Offer',
      name: `${plan.name} — Mensuel`,
      price: monthlyPriceEur,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      url: offerUrl,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: Number(monthlyPriceEur),
        priceCurrency: 'EUR',
        unitText: 'mois',
        referenceQuantity: {
          '@type': 'QuantitativeValue',
          value: 1,
          unitCode: 'MON',
        },
      },
    },
  ]

  if (plan.annualPrice > 0) {
    offers.push({
      '@type': 'Offer',
      name: `${plan.name} — Annuel`,
      price: annualPriceEur,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
      url: offerUrl,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: Number(annualPriceEur),
        priceCurrency: 'EUR',
        unitText: 'an',
        referenceQuantity: {
          '@type': 'QuantitativeValue',
          value: 1,
          unitCode: 'ANN',
        },
      },
    })
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    '@id': `${KOVAS_BASE_URL}/pricing#${plan.code}`,
    name: `${COMPANY_IDENTITY.brands.umbrella} ${plan.name}`,
    description: plan.tagline,
    brand: {
      '@type': 'Brand',
      name: COMPANY_IDENTITY.brands.umbrella,
      url: KOVAS_BASE_URL,
    },
    offers,
  }
}

/** Paramètres d'entrée du builder ItemList V3 (3 sous-listes optionnelles). */
export interface PricingItemListInput {
  readonly annuairePlans?: ReadonlyArray<AnnuairePlan>
  readonly logicielPlans?: ReadonlyArray<LogicielPlan>
  readonly bundles?: ReadonlyArray<BundleCombo>
}

/**
 * Construit la liste itémisée Schema.org des forfaits KOVAS V3.
 *
 * Combine annuaire + logiciel + bundles dans un seul ItemList ordonné.
 * Les plans gratuits (monthlyPrice = 0) sont conservés mais avec un seul
 * offer mensuel à 0,00 €. Les bundles utilisent le label `name`.
 *
 * Surcharge sans argument : retourne la liste legacy KOVAS_TIERS (3 tiers).
 */
export function buildPricingItemListSchema(
  input?: PricingItemListInput,
): ItemListSchema {
  if (!input) {
    return buildLegacyPricingItemListSchema()
  }

  const items: ProductSchema[] = []

  for (const plan of input.annuairePlans ?? []) {
    items.push(buildV3ServiceSchema(plan, `#${plan.code}`))
  }

  for (const plan of input.logicielPlans ?? []) {
    items.push(buildV3ServiceSchema(plan, `#${plan.code}`))
  }

  for (const bundle of input.bundles ?? []) {
    items.push(buildV3ServiceSchema(bundle, `#${bundle.code}`))
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Forfaits ${COMPANY_IDENTITY.brands.umbrella}`,
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem' as const,
      position: idx + 1,
      item,
    })),
  }
}

/** Données nécessaires à la construction d'un Article. */
export interface ArticleForSchema {
  readonly headline: string
  readonly description: string
  readonly slug: string
  readonly datePublished: string
  readonly dateModified?: string
  readonly image?: string
  readonly authorName?: string
}

/** Construit la balise Article pour une page éditoriale `/conseils/[slug]`. */
export function buildArticleSchema(article: ArticleForSchema): ArticleSchema {
  const url = `${KOVAS_BASE_URL}/conseils/${article.slug}`
  const author: PersonSchema = {
    '@type': 'Person',
    name: article.authorName ?? COMPANY_IDENTITY.legalRepresentative.fullName,
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: article.headline,
    description: article.description,
    image: article.image ? [article.image] : undefined,
    datePublished: article.datePublished,
    dateModified: article.dateModified ?? article.datePublished,
    author,
    publisher: { '@id': `${KOVAS_BASE_URL}/#organization` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    inLanguage: 'fr-FR',
  }
}

/** Élément simple d'un fil d'Ariane. */
export interface BreadcrumbItemInput {
  readonly name: string
  /** Chemin absolu (ex. "/diagnostiqueurs/75/paris"). Sera préfixé par KOVAS_BASE_URL. */
  readonly path: string
}

/** Construit la balise BreadcrumbList à partir d'une liste de niveaux. */
export function buildBreadcrumbList(items: readonly BreadcrumbItemInput[]): BreadcrumbListSchema {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem' as const,
      position: idx + 1,
      name: item.name,
      item: item.path.startsWith('http') ? item.path : `${KOVAS_BASE_URL}${item.path}`,
    })),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers internes
// ───────────────────────────────────────────────────────────────────────────

/**
 * Sérialise un objet Schema.org en JSON sécurisé pour injection inline.
 * Échappe les `<` pour prévenir tout vecteur XSS via balise `</script>`.
 */
export function serializeSchema(schema: object): string {
  return JSON.stringify(schema).replace(/</g, '\\u003c')
}

/** Slugify minimaliste pour normaliser une ville en segment d'URL. */
function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
