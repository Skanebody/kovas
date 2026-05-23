/**
 * Helpers JSON-LD schema.org typés via `schema-dts`.
 *
 * Couche 5 industrialisation qualité — chaque page publique de kovas.fr expose
 * un graphe schema.org adapté à son intent SEO :
 *
 * - `/`                            : Organization + LocalBusiness KOVAS éditeur
 * - `/pricing`                     : Product[] (1 par plan) + Organization
 * - `/trouver-un-diagnostiqueur/[slug]`      : LocalBusiness (fiche diagnostiqueur) + BreadcrumbList
 * - `/faq`                         : FAQPage
 * - `/blog/[slug]`                 : Article + BreadcrumbList
 * - `/qui-sommes-nous`             : Organization (NEXUS 1993)
 * - `/pour-les-diagnostiqueurs`    : Service[] (par type de diagnostic) + Organization
 *
 * Tous les helpers retournent un objet typé `WithContext<T>` directement injectable
 * dans le composant `<StructuredData />`.
 */

import type {
  Article,
  BreadcrumbList,
  FAQPage,
  LocalBusiness,
  Offer,
  Organization,
  Product,
  Service,
  WithContext,
} from 'schema-dts'

// ────────────────────────────────────────────────────────────────────────────
// Constantes éditeur (source unique de vérité — synchroniser avec
// company-identity.ts si modifié).
// ────────────────────────────────────────────────────────────────────────────

const SITE_URL = 'https://kovas.fr' as const
const LOGO_URL = `${SITE_URL}/icons/icon-512.png` as const
const PUBLISHER_NAME = 'NEXUS 1993' as const
const PRODUCT_NAME_B2B = 'KOVAS 360' as const
const PRODUCT_NAME_B2C = 'KOVAS Annuaire' as const

// ────────────────────────────────────────────────────────────────────────────
// Types métier (interfaces consommées par les composants pages)
// ────────────────────────────────────────────────────────────────────────────

export interface DiagnosticianProfile {
  slug: string
  displayName: string
  city: string
  postalCode: string
  streetAddress?: string
  region?: string
  phone?: string
  email?: string
  websiteUrl?: string
  diagnosticTypes: ReadonlyArray<string>
  ratingAverage?: number
  ratingCount?: number
  description?: string
  latitude?: number
  longitude?: number
}

export interface BlogPostMeta {
  slug: string
  title: string
  description: string
  publishedAt: string // ISO 8601
  updatedAt?: string // ISO 8601
  authorName: string
  coverImageUrl?: string
  tags?: ReadonlyArray<string>
}

export interface PricingPlanMeta {
  code: string
  name: string
  priceEurMonthly: number
  description: string
  features?: ReadonlyArray<string>
}

export interface FaqItem {
  question: string
  answer: string
}

export interface BreadcrumbCrumb {
  name: string
  url: string
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/**
 * Organization KOVAS — utilisable comme nœud "publisher" ou racine du graphe.
 */
export function getOrganizationSchema(): WithContext<Organization> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: PUBLISHER_NAME,
    legalName: 'NEXUS 1993',
    alternateName: ['KOVAS', PRODUCT_NAME_B2B, PRODUCT_NAME_B2C],
    url: SITE_URL,
    logo: LOGO_URL,
    foundingDate: '2023-12-27',
    founders: [
      {
        '@type': 'Person',
        name: 'Benjamin Bel',
      },
    ],
    taxID: 'FR18982786154',
    vatID: 'FR18982786154',
    address: {
      '@type': 'PostalAddress',
      streetAddress: '66 Avenue des Champs Élysées',
      postalCode: '75008',
      addressLocality: 'Paris',
      addressCountry: 'FR',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: 'contact@kovas.fr',
      availableLanguage: ['French'],
    },
    sameAs: ['https://www.linkedin.com/company/kovas-app'],
  }
}

/**
 * LocalBusiness — pour la racine /, ou pour une fiche diagnostiqueur si
 * `diagnostician` est fourni.
 */
export function getLocalBusinessSchema(
  diagnostician?: DiagnosticianProfile,
): WithContext<LocalBusiness> {
  if (!diagnostician) {
    return {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      '@id': `${SITE_URL}/#business`,
      name: 'KOVAS',
      url: SITE_URL,
      image: LOGO_URL,
      description:
        'Logiciel SaaS B2B + annuaire public pour diagnostiqueurs immobiliers indépendants.',
      address: {
        '@type': 'PostalAddress',
        streetAddress: '66 Avenue des Champs Élysées',
        postalCode: '75008',
        addressLocality: 'Paris',
        addressCountry: 'FR',
      },
      priceRange: '€€',
      areaServed: { '@type': 'Country', name: 'France' },
    }
  }

  const business: WithContext<LocalBusiness> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `${SITE_URL}/trouver-un-diagnostiqueur/${diagnostician.slug}#business`,
    name: diagnostician.displayName,
    url: `${SITE_URL}/trouver-un-diagnostiqueur/${diagnostician.slug}`,
    description: diagnostician.description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: diagnostician.streetAddress,
      postalCode: diagnostician.postalCode,
      addressLocality: diagnostician.city,
      addressRegion: diagnostician.region,
      addressCountry: 'FR',
    },
    areaServed: {
      '@type': 'City',
      name: diagnostician.city,
    },
    telephone: diagnostician.phone,
    email: diagnostician.email,
    priceRange: '€€',
  }

  if (diagnostician.latitude !== undefined && diagnostician.longitude !== undefined) {
    business.geo = {
      '@type': 'GeoCoordinates',
      latitude: diagnostician.latitude,
      longitude: diagnostician.longitude,
    }
  }

  if (
    diagnostician.ratingAverage !== undefined &&
    diagnostician.ratingCount !== undefined &&
    diagnostician.ratingCount > 0
  ) {
    business.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: diagnostician.ratingAverage,
      reviewCount: diagnostician.ratingCount,
      bestRating: 5,
      worstRating: 1,
    }
  }

  return business
}

/**
 * Service par type de diagnostic — utilisé sur /pour-les-diagnostiqueurs
 * et sur la fiche diagnostiqueur pour décrire ce qu'il propose.
 */
export function getServiceSchema(diagnostic: string): WithContext<Service> {
  const labelByCode: Record<string, { name: string; description: string }> = {
    DPE: {
      name: 'Diagnostic de performance énergétique (DPE)',
      description:
        'Évaluation de la performance énergétique et climatique d’un logement (classes A à G).',
    },
    AMIANTE: {
      name: 'Diagnostic amiante (DAPP/DTA)',
      description:
        'Repérage des matériaux et produits contenant de l’amiante avant-vente ou avant-travaux.',
    },
    PLOMB: {
      name: 'Constat de risque d’exposition au plomb (CREP)',
      description: 'Repérage du plomb dans les revêtements des logements construits avant 1949.',
    },
    GAZ: {
      name: 'Diagnostic gaz',
      description:
        'État de l’installation intérieure de gaz pour les installations de plus de 15 ans.',
    },
    ELECTRICITE: {
      name: 'Diagnostic électricité',
      description:
        'État de l’installation électrique intérieure pour les installations de plus de 15 ans.',
    },
    TERMITES: {
      name: 'État relatif à la présence de termites',
      description: 'Diagnostic obligatoire en zone d’infestation déclarée par arrêté préfectoral.',
    },
    CARREZ: {
      name: 'Mesurage Loi Carrez / Boutin',
      description:
        'Mesurage de la superficie privative d’un lot de copropriété (Carrez) ou de la surface habitable (Boutin).',
    },
    ERP: {
      name: 'État des risques et pollutions (ERP)',
      description:
        'Information acquéreurs/locataires sur les risques naturels, miniers, technologiques.',
    },
  }

  const fallback = {
    name: `Diagnostic ${diagnostic}`,
    description: `Prestation de diagnostic immobilier ${diagnostic}.`,
  }
  const meta = labelByCode[diagnostic] ?? fallback

  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: meta.name,
    description: meta.description,
    provider: getOrganizationSchema(),
    serviceType: meta.name,
    areaServed: { '@type': 'Country', name: 'France' },
    category: 'Diagnostic immobilier',
  }
}

/**
 * FAQPage — composable depuis FAQ_LANDING ou /faq.
 */
export function getFAQPageSchema(faqs: ReadonlyArray<FaqItem>): WithContext<FAQPage> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  }
}

/**
 * Article — blog post.
 */
export function getArticleSchema(post: BlogPostMeta): WithContext<Article> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${SITE_URL}/blog/${post.slug}#article`,
    headline: post.title,
    description: post.description,
    image: post.coverImageUrl,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: {
      '@type': 'Person',
      name: post.authorName,
    },
    publisher: getOrganizationSchema(),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/blog/${post.slug}`,
    },
    keywords: post.tags?.join(', '),
  }
}

/**
 * BreadcrumbList — fil d'Ariane.
 * Le 1er élément est généralement "Accueil" → SITE_URL.
 */
export function getBreadcrumbListSchema(
  items: ReadonlyArray<BreadcrumbCrumb>,
): WithContext<BreadcrumbList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/**
 * Product — un plan tarifaire.
 */
export function getProductSchema(plan: PricingPlanMeta): WithContext<Product> {
  const offer: Offer = {
    '@type': 'Offer',
    priceCurrency: 'EUR',
    price: plan.priceEurMonthly.toFixed(2),
    availability: 'https://schema.org/InStock',
    url: `${SITE_URL}/pricing`,
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price: plan.priceEurMonthly.toFixed(2),
      priceCurrency: 'EUR',
      unitText: 'MONTH',
      referenceQuantity: {
        '@type': 'QuantitativeValue',
        value: 1,
        unitCode: 'MON',
      },
    },
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${PRODUCT_NAME_B2B} — ${plan.name}`,
    description: plan.description,
    brand: {
      '@type': 'Brand',
      name: 'KOVAS',
    },
    offers: offer,
    category: 'SaaS',
    additionalProperty: plan.features?.map((feature) => ({
      '@type': 'PropertyValue',
      name: 'feature',
      value: feature,
    })),
  }
}
