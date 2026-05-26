/**
 * OG image dynamique — Tarifs (`/tarifs`).
 *
 * Lot B88 — généré via Next.js 15 ImageResponse, edge runtime, 1200×630.
 * Mot italic chartreuse autorisé : convertit conversion (vente, essai, gain).
 */

import type { ImageResponse } from 'next/og'

import { OG_CONTENT_TYPE, OG_SIZE, buildOgImage } from '@/lib/seo/og-image-template'

export const runtime = 'edge'
export const alt = 'KOVAS — Tarifs transparents dès 19€/mois'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function OpenGraphImage(): ImageResponse {
  return buildOgImage({
    eyebrow: 'KOVAS · Tarifs transparents',
    editorial: {
      before: '',
      italic: 'Tarifs',
      after: 'transparents.',
    },
    tagline: 'Logiciel dès 29€ · Annuaire dès 19€ · Bundles dès 39€',
  })
}
