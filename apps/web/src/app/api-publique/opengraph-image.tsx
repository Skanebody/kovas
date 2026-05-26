/**
 * OG image dynamique — API publique (`/api-publique`).
 *
 * Lot B88 — généré via Next.js 15 ImageResponse, edge runtime, 1200×630.
 */

import type { ImageResponse } from 'next/og'

import { OG_CONTENT_TYPE, OG_SIZE, buildOgImage } from '@/lib/seo/og-image-template'

export const runtime = 'edge'
export const alt = 'KOVAS — API publique open data diagnostic immobilier'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function OpenGraphImage(): ImageResponse {
  return buildOgImage({
    eyebrow: 'KOVAS · API publique open data',
    editorial: {
      before: '',
      italic: 'API publique',
      after: 'KOVAS.',
    },
    tagline: 'Profil propriété · Observatoire · Commune · OpenAPI',
  })
}
