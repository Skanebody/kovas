/**
 * OG image dynamique — Témoignages (`/temoignages`).
 *
 * Lot B88 — généré via Next.js 15 ImageResponse, edge runtime, 1200×630.
 */

import type { ImageResponse } from 'next/og'

import { OG_CONTENT_TYPE, OG_SIZE, buildOgImage } from '@/lib/seo/og-image-template'

export const runtime = 'edge'
export const alt = 'KOVAS — Témoignages diagnostiqueurs immobiliers'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function OpenGraphImage(): ImageResponse {
  return buildOgImage({
    eyebrow: 'KOVAS · Témoignages terrain',
    editorial: {
      before: '',
      italic: 'Témoignages',
      after: 'diagnostiqueurs.',
    },
    tagline: '15+ retours terrain · Notation 4.8/5',
  })
}
