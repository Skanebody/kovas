/**
 * OG image dynamique — Démo (`/demo`).
 *
 * Lot B88 — généré via Next.js 15 ImageResponse, edge runtime, 1200×630.
 */

import type { ImageResponse } from 'next/og'

import { OG_CONTENT_TYPE, OG_SIZE, buildOgImage } from '@/lib/seo/og-image-template'

export const runtime = 'edge'
export const alt = 'KOVAS — Démo personnalisée 30 min avec Benjamin'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function OpenGraphImage(): ImageResponse {
  return buildOgImage({
    eyebrow: 'KOVAS · Démo personnalisée',
    editorial: {
      before: '',
      italic: 'Démo',
      after: 'KOVAS.',
    },
    tagline: '30 min one-to-one avec Benjamin · Aucune obligation',
  })
}
