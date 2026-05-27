/**
 * Builders JSON-LD pour les pages programmatiques (Service, FAQ, Breadcrumb,
 * LocalBusiness mock). Typés via `Record<string, unknown>` pour rester
 * compatibles avec `dangerouslySetInnerHTML`.
 */

import type { City } from '@/lib/cities/registry'
import {
  DIAGNOSTIC_DESCRIPTIONS,
  DIAGNOSTIC_LABELS,
  DIAGNOSTIC_LONG_LABELS,
  DIAGNOSTIC_PRICE_RANGES,
  type DiagnosticType,
} from '@/lib/diagnostics/types'
import type { FaqItem } from '@/lib/seo-content/template-generator'

const SITE_URL = 'https://kovas.fr'

export interface BreadcrumbCrumbLD {
  readonly name: string
  readonly url: string
}

export function buildBreadcrumbLD(
  crumbs: ReadonlyArray<BreadcrumbCrumbLD>,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: crumb.name,
      item: crumb.url,
    })),
  }
}

export function buildFaqLD(faq: ReadonlyArray<FaqItem>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}

export function buildServiceLD(
  type: DiagnosticType,
  city: City,
  basePath: string,
): Record<string, unknown> {
  const range = DIAGNOSTIC_PRICE_RANGES[type]
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `${DIAGNOSTIC_LONG_LABELS[type]} à ${city.name}`,
    description: DIAGNOSTIC_DESCRIPTIONS[type],
    serviceType: DIAGNOSTIC_LONG_LABELS[type],
    category: 'Diagnostic immobilier',
    provider: {
      '@type': 'Organization',
      name: 'KOVAS',
      url: SITE_URL,
    },
    areaServed: {
      '@type': 'City',
      name: city.name,
      address: {
        '@type': 'PostalAddress',
        addressLocality: city.name,
        postalCode: city.postalCode,
        addressCountry: 'FR',
      },
    },
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'EUR',
      lowPrice: range.min,
      highPrice: range.max,
      url: `${SITE_URL}${basePath}/${type}/${city.slug}`,
    },
  }
}

export interface MockDiagnosticianBusiness {
  readonly id: string
  readonly displayName: string
  readonly streetAddress?: string
  readonly phone?: string
  readonly ratingAvg?: number
  readonly ratingCount?: number
  readonly latitude?: number
  readonly longitude?: number
}

export function buildLocalBusinessListLD(
  diags: ReadonlyArray<MockDiagnosticianBusiness>,
  city: City,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Diagnostiqueurs immobiliers à ${city.name}`,
    numberOfItems: diags.length,
    itemListElement: diags.map((d, idx) => {
      const business: Record<string, unknown> = {
        '@type': 'LocalBusiness',
        name: d.displayName,
        address: {
          '@type': 'PostalAddress',
          streetAddress: d.streetAddress,
          addressLocality: city.name,
          postalCode: city.postalCode,
          addressCountry: 'FR',
        },
        telephone: d.phone,
      }
      if (d.latitude !== undefined && d.longitude !== undefined) {
        business.geo = {
          '@type': 'GeoCoordinates',
          latitude: d.latitude,
          longitude: d.longitude,
        }
      }
      if (d.ratingAvg !== undefined && d.ratingCount !== undefined && d.ratingCount > 0) {
        business.aggregateRating = {
          '@type': 'AggregateRating',
          ratingValue: d.ratingAvg,
          reviewCount: d.ratingCount,
        }
      }
      return {
        '@type': 'ListItem',
        position: idx + 1,
        item: business,
      }
    }),
  }
}

/**
 * Génère 3-5 diagnostiqueurs mock cohérents pour une ville. V1 = placeholder
 * tant que la table `diagnosticians` Supabase n'est pas branchée sur ces
 * pages. Données déterministes (seed = slug ville).
 */
export function buildMockDiagnosticians(
  city: City,
  count = 5,
): ReadonlyArray<MockDiagnosticianBusiness> {
  const seedFor = (s: string, i: number): number => {
    let hash = 2166136261
    const input = `${s}:${i}`
    for (let j = 0; j < input.length; j++) {
      hash ^= input.charCodeAt(j)
      hash = Math.imul(hash, 16777619)
    }
    return Math.abs(hash)
  }

  const firstNames = ['Cabinet', 'Expertise', 'Diagnostic', 'Bureau', 'Conseil'] as const
  const lastNames = [
    'Immo',
    'Habitat',
    'Conseil',
    'Pro',
    'Plus',
    'Expertise',
    'Évaluation',
  ] as const

  const result: MockDiagnosticianBusiness[] = []
  for (let i = 0; i < count; i++) {
    const seed = seedFor(city.slug, i)
    const fn = firstNames[seed % firstNames.length]
    const ln = lastNames[(seed >> 4) % lastNames.length]
    if (fn === undefined || ln === undefined) continue
    const rating = 4 + (seed % 10) / 10
    const ratingCount = 12 + (seed % 87)
    result.push({
      id: `${city.slug}-${i}`,
      displayName: `${fn} ${ln} ${city.name}`,
      streetAddress: `${1 + (seed % 99)} rue de la République`,
      phone: undefined,
      ratingAvg: Math.round(rating * 10) / 10,
      ratingCount,
      latitude: city.lat + ((seed % 10) - 5) / 1000,
      longitude: city.lng + (((seed >> 3) % 10) - 5) / 1000,
    })
  }
  return result
}

export function buildPriceSpecLD(type: DiagnosticType, city: City): Record<string, unknown> {
  const range = DIAGNOSTIC_PRICE_RANGES[type]
  return {
    '@context': 'https://schema.org',
    '@type': 'PriceSpecification',
    name: `Prix d’un ${DIAGNOSTIC_LABELS[type]} à ${city.name}`,
    priceCurrency: 'EUR',
    minPrice: range.min,
    maxPrice: range.max,
    valueAddedTaxIncluded: true,
    eligibleQuantity: {
      '@type': 'QuantitativeValue',
      unitText: 'C62',
    },
  }
}
