'use client'

import type { DiagnosticBreakdown } from '@/lib/scheduling/duration-estimator'
import { cn } from '@/lib/utils'

const DIAGNOSTIC_LABELS: Record<string, string> = {
  DPE: 'DPE',
  AMIANTE: 'Amiante',
  PLOMB: 'Plomb CREP',
  GAZ: 'Gaz',
  ELEC: 'Électricité',
  TERMITES: 'Termites',
  CARREZ: 'Carrez / Boutin',
  ERP: 'ERP',
}

interface DurationBreakdownProps {
  breakdown: DiagnosticBreakdown[]
  bufferMinutes: number
  className?: string
}

/**
 * Breakdown détaillé du calcul de durée : un diagnostic par ligne avec sa
 * durée finale (post-coefficients), puis le buffer transition en italique.
 *
 * Sous-composant de DurationEstimator (collapsible).
 */
export function DurationBreakdown({ breakdown, bufferMinutes, className }: DurationBreakdownProps) {
  return (
    <ul className={cn('space-y-1.5', className)}>
      {breakdown.map((row) => (
        <li key={row.diagnostic} className="flex items-baseline justify-between gap-3 text-[13px]">
          <span className="text-ink">{DIAGNOSTIC_LABELS[row.diagnostic] ?? row.diagnostic}</span>
          <span className="font-mono text-ink-mute tabular-nums">
            {formatMinutes(row.finalMinutes)}
          </span>
        </li>
      ))}
      <li className="flex items-baseline justify-between gap-3 text-[13px] italic text-ink-mute pt-1 mt-1 border-t border-rule/60">
        <span>Buffer transition</span>
        <span className="font-mono tabular-nums">{formatMinutes(bufferMinutes)}</span>
      </li>
    </ul>
  )
}

function formatMinutes(min: number): string {
  const rounded = Math.round(min)
  if (rounded < 60) return `${rounded} min`
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  if (m === 0) return `${h} h`
  return `${h} h ${String(m).padStart(2, '0')}`
}
