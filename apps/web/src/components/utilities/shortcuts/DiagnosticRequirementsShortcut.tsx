'use client'

import { Button } from '@/components/ui/button'
import { Lightbulb } from 'lucide-react'
import Link from 'next/link'

interface Props {
  /** Code postal pré-rempli (optionnel) — passé en query string. */
  postalCode?: string
}

/**
 * Raccourci contextuel à coller à côté de l'input postal_code de /app/dossiers/new.
 * Ouvre l'outil de calcul des diagnostics obligatoires dans un nouvel onglet pour
 * ne pas perdre la saisie en cours.
 */
export function DiagnosticRequirementsShortcut({ postalCode }: Props) {
  const href = postalCode
    ? `/app/outils/diagnostics-obligatoires?postal=${encodeURIComponent(postalCode)}`
    : '/app/outils/diagnostics-obligatoires'

  return (
    <Button asChild variant="outline" size="sm">
      <Link href={href} target="_blank" rel="noopener noreferrer">
        <Lightbulb className="size-4" />
        Calculer diagnostics obligatoires
      </Link>
    </Button>
  )
}
