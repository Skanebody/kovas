/**
 * OG image dynamique — Home (`/`).
 *
 * Lot B88 — généré via Next.js 15 ImageResponse, edge runtime, 1200×630.
 * Délègue le rendu au template canonique V5 partagé.
 */

import type { ImageResponse } from 'next/og'

import { OG_CONTENT_TYPE, OG_SIZE, buildOgImage } from '@/lib/seo/og-image-template'

export const runtime = 'edge'
export const alt = 'KOVAS — Le copilote des diagnostiqueurs immobiliers'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function OpenGraphImage(): ImageResponse {
  return buildOgImage({
    eyebrow: 'KOVAS · Diagnostic immobilier',
    editorial: {
      before: 'Le',
      italic: 'copilote',
      after: 'des diagnostiqueurs.',
    },
    tagline: 'Compagnon Liciel · 1h30 gagnée par DPE · Essai 30 jours',
  })
}
