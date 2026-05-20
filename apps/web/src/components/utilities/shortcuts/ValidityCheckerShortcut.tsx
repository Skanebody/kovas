'use client'

import { Button } from '@/components/ui/button'
import { FileCheck } from 'lucide-react'
import Link from 'next/link'

/**
 * Raccourci contextuel à coller sur une fiche client / propriété.
 * Ouvre le vérificateur de validité dans un nouvel onglet.
 */
export function ValidityCheckerShortcut() {
  return (
    <Button asChild variant="outline" size="sm">
      <Link href="/app/outils/verification-validite" target="_blank" rel="noopener noreferrer">
        <FileCheck className="size-4" />
        Vérifier validité diagnostic
      </Link>
    </Button>
  )
}
