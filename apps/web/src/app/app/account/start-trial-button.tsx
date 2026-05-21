'use client'

import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toaster'
import { useTransition } from 'react'

import { startModuleTrialAction } from './actions'

/**
 * Bouton « Essai 14j » d'un module add-on.
 * Appelle `startModuleTrialAction` côté serveur (insert module_trials),
 * affiche un toast succès/erreur et refresh la page.
 */
export function StartTrialButton({ moduleCode }: { moduleCode: string }) {
  const [pending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      const res = await startModuleTrialAction(moduleCode)
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success("Essai 14j démarré. Rappels J+1 / J-5 / J-2 par email.")
      }
    })
  }

  return (
    <Button
      onClick={handleClick}
      disabled={pending}
      size="sm"
      variant="outline"
      className="text-xs h-8 whitespace-nowrap"
    >
      {pending ? 'Activation…' : 'Essai 14j'}
    </Button>
  )
}
