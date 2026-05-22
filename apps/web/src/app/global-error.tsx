'use client'

/**
 * Boundary global pour les erreurs RSC non rattrapées par error.tsx local.
 * Indispensable pour que Sentry capture toutes les erreurs de rendu.
 *
 * Ne pas styliser ici : Next.js refuse les imports CSS dans ce fichier
 * (boundary racine, layout root non monté). On reste sur du HTML brut sobre.
 */
import * as Sentry from '@sentry/nextjs'
import NextError from 'next/error'
import type { ReactElement } from 'react'
import { useEffect } from 'react'

export default function GlobalError({
  error,
}: { error: Error & { digest?: string } }): ReactElement {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="fr">
      <body>
        {/* `NextError` affiche un écran d'erreur sobre par défaut. */}
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
