'use client'

import { DoorOpen, ListChecks } from 'lucide-react'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { setDossierViewPreferenceAction } from './actions'

interface ViewToggleProps {
  dossierId: string
  current: 'rooms' | 'diags'
}

/**
 * Toggle "Vue par pièce" / "Vue par diag" — préférence persistée
 * dans dossier.metadata.viewPreference.
 *
 * Recommandation UX :
 * - "Par pièce" → terrain (matrice horizontale, on suit le parcours physique)
 * - "Par diag" → bureau (matrice verticale, on revoit chaque diagnostic)
 */
export function ViewToggle({ dossierId, current }: ViewToggleProps) {
  const [isPending, startTransition] = useTransition()

  function handleSwitch(target: 'rooms' | 'diags') {
    if (target === current) return
    startTransition(async () => {
      await setDossierViewPreferenceAction(dossierId, target)
    })
  }

  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleSwitch('rooms')}
        disabled={isPending}
        className={cn(
          'h-7 px-3 text-xs',
          current === 'rooms' ? 'bg-muted text-foreground' : 'text-muted-foreground',
        )}
      >
        <DoorOpen className="size-3.5" />
        Par pièce
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleSwitch('diags')}
        disabled={isPending}
        className={cn(
          'h-7 px-3 text-xs',
          current === 'diags' ? 'bg-muted text-foreground' : 'text-muted-foreground',
        )}
      >
        <ListChecks className="size-3.5" />
        Par diag
      </Button>
    </div>
  )
}
