'use client'

import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  experimentId: string
  status: 'draft' | 'running' | 'paused' | 'completed' | 'aborted'
  variants: string[]
}

/**
 * Actions lifecycle expérience (PATCH /api/ab/admin/experiments/[id]).
 * Boutons affichés selon le status courant.
 */
export function ExperimentActions({ experimentId, status, variants }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [winnerVariant, setWinnerVariant] = useState<string>(variants[0] ?? '')

  async function action(name: 'start' | 'pause' | 'conclude' | 'abort') {
    if (pending) return
    setPending(name)
    try {
      const body: { action: string; winnerVariant?: string } = { action: name }
      if (name === 'conclude' && winnerVariant) body.winnerVariant = winnerVariant
      const res = await fetch(`/api/ab/admin/experiments/${experimentId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) router.refresh()
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-2 shrink-0">
      {(status === 'draft' || status === 'paused') && (
        <Button
          variant="default"
          size="sm"
          disabled={pending !== null}
          onClick={() => action('start')}
        >
          {pending === 'start' ? 'Lancement…' : 'Lancer'}
        </Button>
      )}
      {status === 'running' && (
        <Button
          variant="outline"
          size="sm"
          disabled={pending !== null}
          onClick={() => action('pause')}
        >
          {pending === 'pause' ? 'Mise en pause…' : 'Mettre en pause'}
        </Button>
      )}
      {(status === 'running' || status === 'paused') && variants.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <select
            value={winnerVariant}
            onChange={(e) => setWinnerVariant(e.target.value)}
            className="text-[11px] px-2 py-1 rounded-md border border-rule bg-paper text-ink"
          >
            {variants.map((v) => (
              <option key={v} value={v}>
                Gagnant : {v}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            disabled={pending !== null}
            onClick={() => action('conclude')}
          >
            {pending === 'conclude' ? 'Clôture…' : 'Conclure'}
          </Button>
        </div>
      )}
      {status !== 'completed' && status !== 'aborted' && (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending !== null}
          onClick={() => action('abort')}
        >
          {pending === 'abort' ? 'Abandon…' : 'Abandonner'}
        </Button>
      )}
    </div>
  )
}
