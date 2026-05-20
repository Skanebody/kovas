/**
 * MilestonesAchieved — liste des paliers atteints, triés par achieved_at DESC.
 * Server component pur (data déjà chargée côté page).
 */

import { Card } from '@/components/ui/card'
import type { MilestoneWithProgress } from '@/lib/admin/milestones-types'
import { MILESTONE_CATEGORY_LABEL } from '@/lib/admin/milestones-types'
import { Check } from 'lucide-react'
import { categoryClass, formatAchievedAt, formatMilestoneValue } from './milestones-format'

export interface MilestonesAchievedProps {
  milestones: MilestoneWithProgress[]
}

export function MilestonesAchieved({ milestones }: MilestonesAchievedProps) {
  if (milestones.length === 0) {
    return (
      <Card variant="opaque" padding="default">
        <header className="mb-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            ✓ Paliers atteints
          </p>
          <h2 className="font-serif italic text-3xl text-ink mt-1">Aucun palier encore.</h2>
        </header>
        <p className="text-sm text-ink-mute">
          Les paliers s'afficheront ici dès qu'un objectif sera franchi.
        </p>
      </Card>
    )
  }

  return (
    <Card variant="opaque" padding="default">
      <header className="mb-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          ✓ Paliers atteints · {milestones.length}
        </p>
        <h2 className="font-serif italic text-3xl text-ink mt-1">Vos victoires.</h2>
      </header>

      <ul
        className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Paliers atteints"
      >
        {milestones.map((m) => (
          <li
            key={m.id}
            className="rounded-lg border border-rule/60 bg-cream-deep/30 p-4 flex items-start gap-3"
          >
            <span
              className="size-9 rounded-full bg-lime-mist text-[#2D4015] inline-flex items-center justify-center shrink-0"
              aria-hidden
            >
              <Check className="size-4" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {m.icon ? (
                  <span className="text-lg leading-none" aria-hidden>
                    {m.icon}
                  </span>
                ) : null}
                <h3 className="text-[14px] font-semibold tracking-tight text-ink truncate">
                  {m.name}
                </h3>
              </div>
              <p className="font-serif italic text-2xl text-ink leading-none">
                {formatMilestoneValue(m.target_value, m.unit)}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-medium ${categoryClass(m.category)}`}
                >
                  {MILESTONE_CATEGORY_LABEL[m.category]}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">
                  {formatAchievedAt(m.achieved_at)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
