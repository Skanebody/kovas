/**
 * Helpers JSON-LD pour les pages guides `/guide/[type]`.
 *
 * Génère :
 *  - Article (TechArticle) avec datePublished, dateModified, author, publisher
 *  - HowTo pour chaque section dotée de `howToSteps`
 *  - FAQPage agrégeant les questions/réponses de fin de guide
 *  - BreadcrumbList : Accueil > Guides > [Type]
 *
 * Le composant `<JsonLd data={...} />` se charge d'injecter ces objets en
 * Server Component (cf. `@/components/seo/JsonLd`).
 *
 * Note : on évite volontairement `schema-dts` ici pour rester portable
 * entre branches sans nécessiter d'install supplémentaire. Le typage est
 * fait via un alias local `JsonLdObject` (object opaque sérialisable).
 */

import type { Guide, GuideSection } from './types'

const SITE_URL = 'https://kovas.fr' as const
const LOGO_URL = `${SITE_URL}/icons/icon-512.png` as const
const PUBLISHER_NAME = 'NEXUS 1993' as const
const AUTHOR_NAME = 'Équipe KOVAS' as const

/**
 * Type opaque pour les schemas JSON-LD. Volontairement simple — la
 * sérialisation est garantie côté composant `<JsonLd />` via
 * `JSON.stringify`. Schema.org validate côté Google Search Console.
 */
export type JsonLdObject = Record<string, unknown>

/**
 * Article schema pour un guide long (méthode E-E-A-T).
 * Schema.org `Article` est compatible avec les guides éditoriaux longs ;
 * `TechArticle` aurait été envisageable mais Google indexe mieux `Article`.
 *
 * Améliorations E-E-A-T :
 *  - `image` (OG par défaut) pour rich result éligibilité ;
 *  - `author` + `publisher` typés Organization avec logo ;
 *  - `citation` listant les sources externes officielles si fournies ;
 *  - `articleSection` pour catégorisation thématique.
 */
export function buildGuideArticleSchema(guide: Guide): JsonLdObject {
  const imageUrl = guide.heroImage ?? `${SITE_URL}/og/guide/${guide.slug}.png`

  const base: JsonLdObject = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': `${SITE_URL}/guide/${guide.slug}#article`,
    headline: guide.title,
    description: guide.metaDescription,
    image: {
      '@type': 'ImageObject',
      url: imageUrl,
      width: 1200,
      height: 630,
    },
    datePublished: guide.publishedAt,
    dateModified: guide.updatedAt,
    wordCount: guide.wordCount,
    timeRequired: `PT${guide.readingTimeMinutes}M`,
    articleSection: guide.category,
    author: {
      '@type': 'Organization',
      name: AUTHOR_NAME,
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: PUBLISHER_NAME,
      logo: {
        '@type': 'ImageObject',
        url: LOGO_URL,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${SITE_URL}/guide/${guide.slug}`,
    },
    inLanguage: 'fr-FR',
  }

  if (guide.sources && guide.sources.length > 0) {
    base.citation = guide.sources.map((source) => ({
      '@type': 'CreativeWork',
      name: source.title,
      url: source.url,
      publisher: {
        '@type': 'Organization',
        name: source.organization,
      },
    }))
  }

  return base
}

/**
 * Construit un HowTo pour une section ayant des `howToSteps`.
 * Une section sans steps retourne `null` et ne sera pas injectée.
 */
export function buildSectionHowToSchema(guide: Guide, section: GuideSection): JsonLdObject | null {
  if (!section.howToSteps || section.howToSteps.length === 0) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    '@id': `${SITE_URL}/guide/${guide.slug}#howto-${section.id}`,
    name: section.title,
    description: section.paragraphs[0] ?? section.title,
    inLanguage: 'fr-FR',
    step: section.howToSteps.map((step) => ({
      '@type': 'HowToStep',
      position: step.position,
      name: step.name,
      text: step.text,
    })),
  }
}

/**
 * Retourne tous les schemas HowTo applicables à un guide
 * (un par section éligible). Liste vide si aucune section n'a de steps.
 */
export function buildAllHowToSchemas(guide: Guide): ReadonlyArray<JsonLdObject> {
  return guide.sections
    .map((section) => buildSectionHowToSchema(guide, section))
    .filter((schema): schema is JsonLdObject => schema !== null)
}

/**
 * FAQPage agrégeant les questions/réponses de la fin de guide.
 */
export function buildGuideFAQSchema(guide: Guide): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${SITE_URL}/guide/${guide.slug}#faq`,
    mainEntity: guide.faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

/**
 * BreadcrumbList : Accueil > Guides > [Type].
 */
export function buildGuideBreadcrumbSchema(guide: Guide): JsonLdObject {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Accueil',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Guides du diagnostic immobilier',
        item: `${SITE_URL}/guide`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: guide.shortTitle,
        item: `${SITE_URL}/guide/${guide.slug}`,
      },
    ],
  }
}

/**
 * Construit l'ensemble du graphe JSON-LD pour un guide en un seul appel.
 * Retourne un tableau passable directement à `<JsonLd data={...} />`.
 */
export function buildGuideSchemaGraph(guide: Guide): ReadonlyArray<JsonLdObject> {
  return [
    buildGuideArticleSchema(guide),
    ...buildAllHowToSchemas(guide),
    buildGuideFAQSchema(guide),
    buildGuideBreadcrumbSchema(guide),
  ]
}
