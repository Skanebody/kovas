/**
 * Helper minimaliste `buildSeoMetadata()` pour les 6 templates programmatiques.
 *
 * Garantit la cohérence SEO transverse (title, description, canonical, OG,
 * Twitter, hreflang fr-FR, robots index/follow).
 *
 * Ne dépend d'aucun module externe — autonome pour scaler à 15k pages
 * statiques sans collision avec `lib/seo/metadata.ts` du main repo.
 */

import type { Metadata } from 'next'

export const KOVAS_SITE_URL = 'https://kovas.fr' as const
const DEFAULT_OG_IMAGE = '/og-image.png' as const

export interface BuildSeoMetadataParams {
  readonly title: string
  readonly description: string
  readonly path: string
  readonly ogImage?: string
  readonly noindex?: boolean
}

function resolveOgImage(input: string | undefined): string {
  if (input && input.startsWith('http')) return input
  if (input && input.startsWith('/')) return `${KOVAS_SITE_URL}${input}`
  if (input) return `${KOVAS_SITE_URL}/${input}`
  return `${KOVAS_SITE_URL}${DEFAULT_OG_IMAGE}`
}

function normalizePath(path: string): string {
  if (path.length === 0) return '/'
  return path.startsWith('/') ? path : `/${path}`
}

export function buildSeoMetadata(params: BuildSeoMetadataParams): Metadata {
  const path = normalizePath(params.path)
  const url = `${KOVAS_SITE_URL}${path}`
  const ogImage = resolveOgImage(params.ogImage)

  return {
    title: params.title,
    description: params.description,
    openGraph: {
      type: 'website',
      title: params.title,
      description: params.description,
      url,
      siteName: 'KOVAS',
      locale: 'fr_FR',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: params.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: params.title,
      description: params.description,
      images: [ogImage],
    },
    alternates: {
      canonical: url,
      languages: {
        'fr-FR': url,
        'x-default': url,
      },
    },
    robots: params.noindex
      ? {
          index: false,
          follow: false,
          googleBot: { index: false, follow: false },
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        },
  }
}
