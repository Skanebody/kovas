/**
 * OG image dynamique — Comparatif (`/comparatif`).
 *
 * Lot B88 — généré via Next.js 15 ImageResponse, edge runtime, 1200×630.
 */

import type { ImageResponse } from 'next/og'

import { OG_CONTENT_TYPE, OG_SIZE, buildOgImage } from '@/lib/seo/og-image-template'

export const runtime = 'edge'
export const alt = 'KOVAS — Liciel + KOVAS, 1h30 gagnée par DPE'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function OpenGraphImage(): ImageResponse {
  return buildOgImage({
    eyebrow: 'KOVAS · Comparatif logiciels',
    editorial: {
      before: 'Liciel',
      italic: '+ KOVAS.',
      after: '',
    },
    tagline: '1h30 gagnée · Zéro erreur ADEME · Leads B2C qualifiés',
  })
}
