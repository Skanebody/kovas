'use client'

import { cn } from '@/lib/utils'

export type ProgressionView = 'by-diagnostic' | 'by-room' | 'by-critical-field'

interface ProgressionViewToggleProps {
  value: ProgressionView
  onChange: (next: ProgressionView) => void
  className?: string
}

const OPTIONS: Array<{ id: ProgressionView; label: string }> = [
  { id: 'by-diagnostic', label: 'Par diagnostic' },
  { id: 'by-room', label: 'Par pièce' },
  { id: 'by-critical-field', label: 'Par champ critique' },
]

/**
 * Toggle 3 vues pour la section Progression — pillules tab-like.
 *
 * Active : navy + paper. Inactive : transparent + hover sage-alt.
 */
export function ProgressionViewToggle({ value, onChange, className }: ProgressionViewToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="Vue de progression"
      className={cn('inline-flex items-center gap-1 rounded-pill bg-sage-alt p-1', className)}
    >
      {OPTIONS.map((opt) => {
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={cn(
              'rounded-pill px-3.5 py-1.5 text-[12px] font-medium transition-colors duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/30',
              active
                ? 'bg-navy text-paper shadow-sm'
                : 'text-ink-soft hover:bg-paper/60 hover:text-ink',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
