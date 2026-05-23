/**
 * KOVAS — Route handler /presse/kit-medias
 *
 * V1 (lot #147 SITE-ANNEXES, mis à jour lot #153 SITE-POLISH) : le kit
 * médias complet (logos HD, photo fondateur, fiche société, charte graphique)
 * est en cours de finalisation pour le lancement T4 2026.
 *
 * Cette route retourne une réponse JSON 200 OK avec statut `available_v2`,
 * lisible par un éventuel client JSON et explicite pour un journaliste qui
 * tomberait sur l'URL. L'unique adresse de contact publique est
 * `contact@kovas.fr` (lot #153 : sweep email).
 *
 * V1.5 : générer dynamiquement le ZIP via JSZip en streaming, en lisant les
 * assets depuis `public/press-kit/` (logos, photo, PDF charte graphique).
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      status: 'available_v2',
      message:
        'Le kit médias complet sera disponible courant 2026 au moment du lancement public.',
      contact: 'contact@kovas.fr',
    },
    {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=3600',
      },
    },
  )
}
