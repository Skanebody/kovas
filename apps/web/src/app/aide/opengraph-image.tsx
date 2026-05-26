/**
 * OG image dynamique — Aide (`/aide`).
 *
 * Lot B88 — généré via Next.js 15 ImageResponse, edge runtime, 1200×630.
 */

import type { ImageResponse } from 'next/og'

import { OG_CONTENT_TYPE, OG_SIZE, buildOgImage } from '@/lib/seo/og-image-template'

export const runtime = 'edge'
export const alt = "KOVAS — Centre d'aide diagnostiqueur immobilier"
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function OpenGraphImage(): ImageResponse {
  return buildOgImage({
    eyebrow: "KOVAS · Centre d'aide",
    editorial: {
      before: '',
      italic: "Centre d'aide",
      after: 'KOVAS.',
    },
    tagline: 'Démarrage · FAQ · Tutoriels · Contact contact@kovas.fr',
  })
}
