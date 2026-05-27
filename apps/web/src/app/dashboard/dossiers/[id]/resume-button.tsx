'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle2, Loader2, Play } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'
import { resumeMissionAction } from './actions'

interface ResumeButtonProps {
  missionId: string
  status: string
}

const RESUMABLE_STATES = ['draft', 'scheduled', 'in_progress', 'to_review']

const STATUS_VERB: Record<string, string> = {
  draft: 'Démarrer',
  scheduled: 'Démarrer',
  in_progress: 'Reprendre',
  to_review: 'Reprendre',
}

export function ResumeButton({ missionId, status }: ResumeButtonProps) {
  const [isPending, startTransition] = useTransition()
  const [justActed, setJustActed] = useState(false)
  const justActedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (justActedTimer.current) clearTimeout(justActedTimer.current)
    }
  }, [])

  if (!RESUMABLE_STATES.includes(status)) return null

  const label = STATUS_VERB[status] ?? 'Reprendre'

  function handleClick() {
    startTransition(async () => {
      try {
        await resumeMissionAction(missionId)
        // Visual feedback : check vert pendant 1.2s
        setJustActed(true)
        if (justActedTimer.current) clearTimeout(justActedTimer.current)
        justActedTimer.current = setTimeout(() => setJustActed(false), 1200)

        // Highlight la card concernée
        const el = document.getElementById(`mission-${missionId}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el?.animate(
          [
            { boxShadow: '0 0 0 2px hsl(var(--accent-green))', offset: 0 },
            { boxShadow: '0 0 0 2px transparent', offset: 1 },
          ],
          { duration: 1500, easing: 'ease-out' },
        )
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Erreur')
      }
    })
  }

  if (justActed) {
    return (
      <Button size="sm" variant="default" disabled>
        <CheckCircle2 className="size-4 text-accent-green" />
        Démarré
      </Button>
    )
  }

  return (
    <Button size="sm" variant="default" onClick={handleClick} disabled={isPending}>
      {isPending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
      {label}
    </Button>
  )
}
