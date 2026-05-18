'use client'

import { Loader2, Play } from 'lucide-react'
import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { resumeMissionAction } from './actions'

interface ResumeButtonProps {
  missionId: string
  /** Statut courant — détermine le label */
  status: string
}

/**
 * Diagnostics qui peuvent être "repris" :
 * - scheduled : pas encore commencé
 * - in_progress : en cours, juste re-focus
 * - to_review : à relire au bureau, on retourne dessus
 * - draft : pas planifié mais on peut le démarrer
 *
 * États finaux non reprenables : done, exported, archived, cancelled.
 */
const RESUMABLE_STATES = ['draft', 'scheduled', 'in_progress', 'to_review']

const STATUS_VERB: Record<string, string> = {
  draft: 'Démarrer',
  scheduled: 'Démarrer',
  in_progress: 'Reprendre',
  to_review: 'Reprendre',
}

export function ResumeButton({ missionId, status }: ResumeButtonProps) {
  const [isPending, startTransition] = useTransition()

  if (!RESUMABLE_STATES.includes(status)) return null

  const label = STATUS_VERB[status] ?? 'Reprendre'

  function handleClick() {
    startTransition(async () => {
      try {
        await resumeMissionAction(missionId)
        // Highlight la card concernée
        const el = document.getElementById(`mission-${missionId}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        el?.animate(
          [
            { backgroundColor: 'hsl(var(--cta) / 0.05)' },
            { backgroundColor: 'transparent' },
          ],
          { duration: 1500, easing: 'ease-out' },
        )
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erreur')
      }
    })
  }

  return (
    <Button size="sm" variant="default" onClick={handleClick} disabled={isPending}>
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
      {label}
    </Button>
  )
}
