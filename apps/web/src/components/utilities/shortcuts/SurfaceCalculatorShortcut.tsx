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
      // Mobile : bottom-24 (96px) = 32px au-dessus de mobile-nav (64px).
      // Desktop (md+) : bottom-8. z-20 (FAB) selon scale.
      className="fixed bottom-24 right-4 z-20 shadow-lg md:bottom-8"
      aria-label="Ouvrir la calculatrice de surface"
    >
      <Link href="/dashboard/outils" target="_blank" rel="noopener noreferrer">
        <Ruler className="size-5" />
      </Link>
    </Button>
  )
}
