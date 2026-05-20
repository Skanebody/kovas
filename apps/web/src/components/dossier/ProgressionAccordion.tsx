'use client'

import { Card } from '@/components/ui/card'
import type { CriticalField, DossierVisualState, ProgressionData } from '@/lib/dossier/types'
import type { DiagnosticType } from '@/lib/mission/types'
import { cn } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'

import { type ProgressionView, ProgressionViewToggle } from './ProgressionViewToggle'
import { ViewByCriticalField } from './ViewByCriticalField'
import { ViewByDiagnostic } from './ViewByDiagnostic'
import { ViewByRoom } from './ViewByRoom'

interface ProgressionAccordionProps {
  dossierId: string
  state: DossierVisualState
  data: ProgressionData
  /** Diagnostics actifs (utilisé pour filter tabs vue 3). */
  activeDiagnostics: DiagnosticType[]
  /** Vue initiale. Défaut : "by-diagnostic". */
  initialView?: ProgressionView
  /** Forcer l'état ouvert/fermé initial. Défaut : ouvert si in-progress. */
  defaultOpen?: boolean
  onEditField?: (field: CriticalField) => void
  onViewSource?: (field: CriticalField) => void
  className?: string
}

/**
 * Accordion principal "Progression" — toggle 3 vues.
 *
 * Ouvert par défaut si l'état du dossier est `in-progress`, fermé sinon.
 * Le toggle de vue (Par diagnostic / Par pièce / Par champ critique) est
 * persistant le temps du cycle de vie du composant (pas localStorage —
 * la page d'assemblage peut prop-driver si besoin).
 */
export function ProgressionAccordion({
  dossierId,
  state,
  data,
  activeDiagnostics,
  initialView = 'by-diagnostic',
  defaultOpen,
  onEditField,
  onViewSource,
  className,
}: ProgressionAccordionProps) {
  const openDefault = defaultOpen ?? state === 'in-progress'
  const [open, setOpen] = useState<boolean>(openDefault)
  const [view, setView] = useState<ProgressionView>(initialView)

  return (
    <Card variant="opaque" padding="none" className={cn('overflow-hidden', className)}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="dossier-progression-body"
        className="flex w-full items-center gap-3 px-7 py-5 text-left transition-colors hover:bg-sage-alt/40"
      >
        <ChevronDown
          aria-hidden
          className={cn('size-4 shrink-0 text-ink-mute transition-transform', open && 'rotate-180')}
        />
        <h2 className="font-serif italic font-normal text-xl text-ink">Progression</h2>
        <span className="ml-auto truncate font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          {data.diagnostics.summary}
        </span>
      </button>

      {open && (
        <div id="dossier-progression-body" className="flex flex-col gap-5 px-7 pb-7">
          <ProgressionViewToggle value={view} onChange={setView} />

          <div>
            {view === 'by-diagnostic' && <ViewByDiagnostic items={data.diagnostics.list} />}
            {view === 'by-room' && (
              <ViewByRoom
                dossierId={dossierId}
                visitedRooms={data.rooms.visitedRooms}
                suggestedRooms={data.rooms.suggestedRooms}
              />
            )}
            {view === 'by-critical-field' && (
              <ViewByCriticalField
                buckets={data.buckets}
                activeDiagnostics={activeDiagnostics}
                onEditField={onEditField}
                onViewSource={onViewSource}
              />
            )}
          </div>
        </div>
      )}
    </Card>
  )
}
