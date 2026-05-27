'use client'

import { toast } from '@/components/ui/toaster'
import { useEffect, useRef } from 'react'

const PHASE_LABEL: Record<string, string> = {
  identity: 'Identité civile',
  cofrac: 'Certification COFRAC',
  rcpro: 'Assurance RC Pro',
  sirene: 'Entreprise SIRENE',
}

/**
 * Affiche un toast de succès quand l'utilisateur revient depuis une
 * re-soumission (querystring `?resubmitted=<phase>`).
 * Anti-doublon via useRef pour éviter le double-fire en dev StrictMode.
 */
export function ResubmitToast({ phase }: { phase: string }) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true

    const label = PHASE_LABEL[phase]
    if (!label) return

    toast.success(`${label} re-soumise`, {
      description: 'Notre équipe vérifie ces informations sous 24-48 h.',
    })
  }, [phase])

  return null
}
