'use client'

import { Button } from '@/components/ui/button'
import { Ruler } from 'lucide-react'
import Link from 'next/link'

/**
 * Bouton flottant — mode terrain. Lance la calculatrice surface dans un onglet
 * dédié pour éviter de perdre la prise de notes/photos en cours.
 */
export function SurfaceCalculatorShortcut() {
  return (
    <Button
      asChild
      variant="default"
      size="icon"
      className="fixed bottom-24 right-4 z-30 shadow-lg md:bottom-8"
      aria-label="Ouvrir la calculatrice de surface"
    >
      <Link href="/app/outils/calculatrice-surface" target="_blank" rel="noopener noreferrer">
        <Ruler className="size-5" />
      </Link>
    </Button>
  )
}
