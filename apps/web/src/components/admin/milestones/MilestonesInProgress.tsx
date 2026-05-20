'use client'

/**
 * MilestonesInProgress — paliers en cours, barre progress + action "marquer atteint".
 *
 * Client component (bouton d'action vers /api/admin/milestones/[id]/achieve).
 */

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { MilestoneWithProgress } from '@/lib/admin/milestones-types'
import { MILESTONE_CATEGORY_LABEL } from '@/lib/admin/milestones-types'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { categoryClass, formatProgressLabel, formatProgressPct } from './milestones-format'

export interface MilestonesInProgressProps {
  milestones: MilestoneWithProgress[]
}

export function MilestonesInProgress({ milestones }: MilestonesInProgressProps) {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const markAchieved = (id: string) => {
    setError(null)
    setPendingId(id)
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/milestones/${id}/achieve`, { method: 'POST' })
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string }
          setError(data.error ?? `HTTP ${res.status}`)
          return
        }
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur réseau')
      } finally {
        setPendingId(null)
      }
    })
  }

  if (milestones.length === 0) {
    return (
      <Card variant="opaque" padding="default">
        <header className="mb-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            🎯 Paliers en cours
          </p>
          <h2 className="font-serif italic text-3xl text-ink mt-1">Tout est atteint.</h2>
        </header>
        <p className="text-sm text-ink-mute">Bravo. Ajoute de nouveaux paliers via la BDD.</p>
      </Card>
    )
  }

  return (
    <Card variant="opaque" padding="default">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            🎯 Paliers en cours · {milestones.length}
          </p>
          <h2 className="font-serif italic text-3xl text-ink mt-1">À franchir.</h2>
        </div>
      </header>

      {error ? (
        <p className="mb-3 text-[12px] text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <ul className="space-y-3" aria-label="Paliers en cours">
        {milestones.map((m) => (
          <li key={m.id} className="rounded-lg border border-rule/60 bg-paper/60 p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {m.icon ? (
                    <span className="text-lg leading-none" aria-hidden>
                      {m.icon}
                    </span>
                  ) : null}
                  <h3 className="text-[14px] font-semibold tracking-tight text-ink truncate">
                    {m.name}
                  </h3>
                  <span
                    className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-medium ${categoryClass(m.category)}`}
                  >
                    {MILESTONE_CATEGORY_LABEL[m.category]}
                  </span>
                </div>
                {m.description ? (
                  <p className="text-[12px] text-ink-mute">{m.description}</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isPending && pendingId === m.id}
                onClick={() => markAchieved(m.id)}
              >
                {isPending && pendingId === m.id ? 'En cours…' : '✓ Atteint'}
              </Button>
            </div>

            {/* Progress bar */}
            <div className="mt-3">
              <div className="flex items-baseline justify-between gap-2 mb-1.5">
                <span className="text-[12px] text-ink-mute font-mono">
                  {formatProgressLabel(m)}
                </span>
                <span className="font-serif italic text-xl text-ink leading-none">
                  {formatProgressPct(m.progress)}
                </span>
              </div>
              <div
                className="h-2 rounded-pill bg-cream-deep/60 overflow-hidden"
                role="progressbar"
                tabIndex={0}
                aria-valuenow={Math.round(m.progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Progression ${m.name}`}
              >
                <div
                  className="h-full bg-chartreuse transition-all duration-base"
                  style={{ width: `${Math.min(100, Math.max(0, m.progress * 100))}%` }}
                />
              </div>
              {m.eta_iso ? (
                <p className="mt-1.5 text-[11px] text-ink-faint">
                  ETA estimé : {new Date(m.eta_iso).toLocaleDateString('fr-FR')}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
