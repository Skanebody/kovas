'use client'

/**
 * ChecklistPanel — panneau flottant top-right mobile résumant l'état de
 * couverture des items checklist par diagnostic.
 *
 * États :
 *  - replié (par défaut) : mini-pastille "DPE 12/30" cliquable
 *  - déplié : carte sage paper avec liste sections + barre progression chartreuse
 *
 * Avatar Benjamin Bel : sobre, vouvoiement, pas d'emoji marketing.
 */

import { Button } from '@/components/ui/button'
import type { CompletionStatus } from '@/lib/local-ai/checklist-tracker'
import type { DiagnosticKind } from '@/lib/local-ai/checklists/types'
import { cn } from '@/lib/utils'
import { Camera, ChevronDown, ChevronUp, ListTodo } from 'lucide-react'
import type * as React from 'react'
import { useState } from 'react'

interface ChecklistPanelProps {
  status: CompletionStatus
  /** Affichage compact pour vue split desktop (force expanded). */
  forceExpanded?: boolean
  className?: string
}

/** Mapping court diagnostic → label affiché compteur. */
const SHORT_LABEL: Record<DiagnosticKind, string> = {
  dpe: 'DPE',
  amiante: 'AMIANTE',
  plomb: 'PLOMB',
  gaz: 'GAZ',
  electricite: 'ELEC',
  termites: 'TERMITES',
  carrez: 'CARREZ',
  boutin: 'BOUTIN',
  erp: 'ERP',
}

export function ChecklistPanel({
  status,
  forceExpanded = false,
  className,
}: ChecklistPanelProps): React.JSX.Element {
  const [expanded, setExpanded] = useState(forceExpanded)
  const isOpen = expanded || forceExpanded

  // Compteurs par diagnostic
  const counts = computeDiagnosticCounts(status)

  const totalCovered = status.covered.length
  const totalRequired =
    totalCovered + status.missing_critical.length + status.missing_important.length

  return (
    <div
      className={cn(
        'fixed top-16 right-4 z-40 w-[calc(100vw-32px)] max-w-[360px]',
        'transition-all duration-base ease-spring',
        className,
      )}
    >
      {/* Header replié = pill cliquable */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-4 py-2.5',
          'bg-paper border border-rule rounded-pill shadow-sm',
          'text-ink hover:bg-sage-alt transition-colors',
          isOpen && 'rounded-b-none rounded-t-lg',
        )}
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 min-w-0">
          <ListTodo className="size-4 text-ink-mute shrink-0" aria-hidden />
          <span className="label-mono text-[11px] truncate">
            {counts.length > 0
              ? counts.map((c) => `${SHORT_LABEL[c.diagnostic]} ${c.covered}/${c.total}`).join(' · ')
              : 'Checklist'}
          </span>
        </span>
        {isOpen ? (
          <ChevronUp className="size-4 text-ink-mute shrink-0" aria-hidden />
        ) : (
          <ChevronDown className="size-4 text-ink-mute shrink-0" aria-hidden />
        )}
      </button>

      {/* Panel déplié */}
      {isOpen && (
        <div className="bg-paper border border-t-0 border-rule rounded-b-lg shadow-md max-h-[60vh] overflow-y-auto">
          {/* Barre de progression chartreuse */}
          <div className="p-4 border-b border-rule">
            <div className="flex items-baseline justify-between mb-2">
              <span className="label-mono text-ink-mute">Progression mission</span>
              <span className="font-mono text-sm font-semibold text-ink">
                {totalCovered}/{totalRequired}
              </span>
            </div>
            <div className="h-2 bg-sage-alt rounded-full overflow-hidden">
              <div
                className="h-full bg-chartreuse transition-all duration-base"
                style={{ width: `${status.percentage}%` }}
                role="progressbar"
                aria-valuenow={status.percentage}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>

          {/* Items critiques manquants */}
          {status.missing_critical.length > 0 && (
            <Section
              title="À compléter"
              subtitle={`${status.missing_critical.length} critique${status.missing_critical.length > 1 ? 's' : ''}`}
              tone="warning"
            >
              <ul className="space-y-1.5">
                {status.missing_critical.slice(0, 8).map((item) => (
                  <li key={item.id} className="flex items-start gap-2 text-[13px] text-ink-soft">
                    <span className="size-1.5 rounded-full bg-warning mt-1.5 shrink-0" aria-hidden />
                    <span className="leading-snug">{item.description_short}</span>
                  </li>
                ))}
                {status.missing_critical.length > 8 && (
                  <li className="text-[12px] text-ink-mute pl-3.5">
                    + {status.missing_critical.length - 8} autre(s)…
                  </li>
                )}
              </ul>
            </Section>
          )}

          {/* Photos manquantes */}
          {status.photos_missing.length > 0 && (
            <Section
              title="Photos manquantes"
              subtitle={`${status.photos_missing.length} élément${status.photos_missing.length > 1 ? 's' : ''}`}
              tone="info"
              icon={<Camera className="size-3.5 text-info" aria-hidden />}
            >
              <ul className="space-y-1.5">
                {status.photos_missing.slice(0, 6).map((item) => (
                  <li key={item.id} className="flex items-start gap-2 text-[13px] text-ink-soft">
                    <span className="size-1.5 rounded-full bg-info mt-1.5 shrink-0" aria-hidden />
                    <span className="leading-snug">{item.description_short}</span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Détail par section */}
          <Section title="Sections" subtitle="Détail par diagnostic" tone="neutral">
            <ul className="space-y-2">
              {status.by_section.map((sec) => (
                <li
                  key={`${sec.diagnostic}::${sec.section_id}`}
                  className="flex items-center justify-between text-[13px]"
                >
                  <span className="text-ink-soft truncate flex-1 pr-2">
                    <span className="label-mono text-ink-mute mr-1">
                      {SHORT_LABEL[sec.diagnostic]}
                    </span>
                    {sec.section_label}
                  </span>
                  <span
                    className={cn(
                      'font-mono text-[12px] tabular-nums shrink-0',
                      sec.remaining_required.length === 0 ? 'text-success' : 'text-ink-mute',
                    )}
                  >
                    {sec.covered_count}/{sec.total_count}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Footer action */}
          <div className="p-3 border-t border-rule bg-sage-alt rounded-b-lg">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-[12px]"
              onClick={() => setExpanded(false)}
            >
              Replier le panneau
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  subtitle,
  tone,
  icon,
  children,
}: {
  title: string
  subtitle: string
  tone: 'warning' | 'info' | 'neutral'
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'p-4 border-b border-rule last:border-b-0',
        tone === 'warning' && 'border-l-2 border-l-warning',
        tone === 'info' && 'border-l-2 border-l-info',
      )}
    >
      <div className="flex items-baseline justify-between mb-2">
        <span className="label-mono text-ink-mute flex items-center gap-1.5">
          {icon}
          {title}
        </span>
        <span className="text-[11px] text-ink-faint">{subtitle}</span>
      </div>
      {children}
    </div>
  )
}

interface DiagnosticCount {
  diagnostic: DiagnosticKind
  covered: number
  total: number
}

function computeDiagnosticCounts(status: CompletionStatus): DiagnosticCount[] {
  const acc = new Map<DiagnosticKind, DiagnosticCount>()
  for (const d of status.diagnostics) {
    acc.set(d, { diagnostic: d, covered: 0, total: 0 })
  }
  for (const sec of status.by_section) {
    const ref = acc.get(sec.diagnostic)
    if (!ref) continue
    ref.covered += sec.covered_count
    ref.total += sec.total_count
  }
  return Array.from(acc.values())
}
