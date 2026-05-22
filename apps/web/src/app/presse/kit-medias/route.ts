/**
 * KOVAS — Route handler /presse/kit-medias (Lot #147 SITE-ANNEXES)
 *
 * V1 : le kit médias complet (logos HD, photo fondateur, fiche société,
 * charte graphique) est en cours de finalisation pour le lancement T4 2026.
 *
 * Cette route retourne une réponse 404 propre avec un message JSON explicite
 * jusqu'à ce que les assets soient déposés. La page /presse référence cette
 * route mais affiche un texte indiquant la disponibilité au lancement.
 *
 * V1.5 : générer dynamiquement le ZIP via JSZip en streaming, en lisant les
 * assets depuis `public/press-kit/` (logos, photo, PDF charte graphique).
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      ok: false,
      message:
        "Le kit médias complet sera disponible au moment du lancement public (T4 2026). Pour une demande urgente, écrivez à presse@kovas.fr.",
      contact: 'presse@kovas.fr',
    },
    {
      status: 404,
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    },
  )
}
