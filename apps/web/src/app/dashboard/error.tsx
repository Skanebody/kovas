'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('App error boundary:', error)
  }, [error])

  return (
    <div className="max-w-xl mx-auto py-16">
      <Card variant="opaque" padding="default">
        <CardContent className="pt-6 space-y-4 text-center">
          <AlertTriangle className="size-10 mx-auto text-accent-red" />
          <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
          <p className="text-sm text-ink-mute">
            {error.message || 'Erreur inconnue. Réessayez ou contactez le support.'}
          </p>
          {error.digest && <p className="text-xs font-mono text-ink-faint">Réf. {error.digest}</p>}
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={reset}>
              <RefreshCw className="size-4" /> Réessayer
            </Button>
            <Button variant="glass" asChild>
              <a href="mailto:contact@kovas.fr">Contacter le support</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
