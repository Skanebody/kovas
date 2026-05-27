/**
 * Helper centralisé `buildMetadata()` pour Next.js 15 App Router.
 *
 * Garantit la cohérence SEO transverse sur toutes les pages publiques KOVAS :
 *  - title + template `{title} · KOVAS`
 *  - canonical absolu calculé depuis `path` relatif
 *  - Open Graph + Twitter Cards alignés (image 1200×630)
 *  - hreflang fr-FR + x-default (mono-locale Phase 1, multi-locale prêt)
 *  - robots indexable par défaut, opt-in noindex pour pages légales / dashboards
 *  - fallback OG image dynamique `/api/og?title=...` si pas d'image custom
 *
 * Usage standard dans une page Server Component :
 *
 *   export const metadata = buildMetadata({
 *     title: 'Calculateur DPE gratuit',
 *     description: 'Estimez votre classe DPE en 2 minutes.',
 *     path: '/calculateur-dpe-gratuit',
 *   })
 *
 * Pour les pages dynamiques avec `generateMetadata` :
 *
 *   export async function generateMetadata({ params }: Props): Promise<Metadata> {
 *     const article = await fetchArticle(params.slug)
 *     return buildMetadata({
 *       title: article.title,
 *       description: article.summary,
 *       path: `/conseils/${article.slug}`,
 *       ogImage: article.coverImageUrl,
 *     })
 *   }
 */

import type { Metadata } from 'next'

/** URL canonique racine KOVAS — doit matcher `metadataBase` du layout. */
export const KOVAS_SITE_URL = 'https://kovas.fr' as const

/** Image OG par défaut (statique) déposée dans /public. */
const DEFAULT_OG_IMAGE = '/og-image.png' as const

export interface BuildMetadataParams {
  /** Titre de la page (sans le suffixe `· KOVAS`, ajouté automatiquement). */
  readonly title: string
  /** Meta description (150-160 caractères idéaux). */
  readonly description: string
  /** Chemin relatif absolu commencant par `/` (ex. `/calculateur-dpe-gratuit`). */
  readonly path: string
  /**
   * URL d'image OG (1200×630 recommandé). Trois options :
   *  - URL absolue (https://…) → utilisée telle quelle
   *  - chemin relatif (/og/…) → préfixé par KOVAS_SITE_URL
   *  - omis → fallback `/og-image.png` statique
   */
  readonly ogImage?: string
  /**
   * Bloquer l'indexation moteur (CGU, dashboards, formulaires confidentiels).
   * Par défaut `false` (page indexable).
   */
  readonly noindex?: boolean
  /**
   * Type OG : `website` (par défaut) ou `article` (blog, conseils, guides).
   */
  readonly ogType?: 'website' | 'article'
  /** Date de publication ISO 8601 — n'affecte que `ogType: 'article'`. */
  readonly publishedTime?: string
  /** Date de modification ISO 8601 — n'affecte que `ogType: 'article'`. */
  readonly modifiedTime?: string
  /** Auteur (article only). */
  readonly authorName?: string
}

/**
 * Résout une URL d'image OG en URL absolue.
 * Gère les 3 cas : absolue / relative / fallback statique.
 */
function resolveOgImage(input: string | undefined): string {
  if (input && input.startsWith('http')) return input
  if (input && input.startsWith('/')) return `${KOVAS_SITE_URL}${input}`
  if (input) return `${KOVAS_SITE_URL}/${input}`
  // Fallback statique pour économiser CPU edge sur les pages courantes.
  // Pour générer dynamiquement à la place :
  //   return `${KOVAS_SITE_URL}/api/og?title=${encodeURIComponent(fallbackTitle)}`
  return `${KOVAS_SITE_URL}${DEFAULT_OG_IMAGE}`
}

/** Normalise un chemin pour qu'il commence toujours par `/`. */
function normalizePath(path: string): string {
  if (path.length === 0) return '/'
  return path.startsWith('/') ? path : `/${path}`
}

/**
 * Construit l'objet `Metadata` Next.js complet pour une page publique KOVAS.
 *
 * Retourne un objet idempotent (peut être appelé dans `export const metadata`
 * ou dans `generateMetadata`). Pour les pages dynamiques, fusionner avec le
 * layout parent via la propagation de `template`.
 */
export function buildMetadata(params: BuildMetadataParams): Metadata {
  const path = normalizePath(params.path)
  const url = `${KOVAS_SITE_URL}${path}`
  const ogImage = resolveOgImage(params.ogImage)
  const ogType = params.ogType ?? 'website'

  const metadata: Metadata = {
    title: params.title,
    description: params.description,
    openGraph: {
      type: ogType,
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
      ...(ogType === 'article' && params.publishedTime
        ? { publishedTime: params.publishedTime }
        : {}),
      ...(ogType === 'article' && params.modifiedTime ? { modifiedTime: params.modifiedTime } : {}),
      ...(ogType === 'article' && params.authorName ? { authors: [params.authorName] } : {}),
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

  return metadata
}

/**
 * Helper utilitaire pour les pages noindex (CGU, CGV, dashboards, formulaires).
 * Réduit la verbosité au point d'appel.
 */
export function buildNoindexMetadata(params: Omit<BuildMetadataParams, 'noindex'>): Metadata {
  return buildMetadata({ ...params, noindex: true })
}
