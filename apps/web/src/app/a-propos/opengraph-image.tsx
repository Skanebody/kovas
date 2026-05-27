/**
 * OG image dynamique — À propos (`/a-propos`).
 *
 * Lot B88 — généré via Next.js 15 ImageResponse, edge runtime, 1200×630.
 */

import type { ImageResponse } from 'next/og'

import { OG_CONTENT_TYPE, OG_SIZE, buildOgImage } from '@/lib/seo/og-image-template'

export const runtime = 'edge'
export const alt = 'KOVAS — À propos de Benjamin Bel, fondateur'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function OpenGraphImage(): ImageResponse {
  return buildOgImage({
    eyebrow: 'KOVAS · Fondateur Benjamin Bel',
    editorial: {
      before: 'À propos de',
      italic: 'Benjamin Bel.',
      after: '',
    },
    tagline: 'Fondateur KOVAS · Solo Dieppe',
  })
}
