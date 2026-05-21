'use client'

import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

export type CalendarViewMode = 'day' | 'week' | 'month' | 'agenda'

const MODES: { value: CalendarViewMode; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'agenda', label: 'Agenda' },
]

interface ViewSwitcherProps {
  value: CalendarViewMode
  onChange: (mode: CalendarViewMode) => void
}

/**
 * Segmented control style iOS — bascule entre les 4 vues calendrier.
 *
 * - Desktop / tablette : 4 pills horizontales (variant pillule dark sur fond
 *   sage-alt). Active = bg `#0F1419` + text white.
 * - Mobile (<sm) : un `<select>` accessible plus compact.
 */
export function ViewSwitcher({ value, onChange }: ViewSwitcherProps) {
  // Petit guard hydratation : sur SSR on rend une version statique.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <>
      {/* Mobile : select natif */}
      <label className="sm:hidden inline-flex items-center gap-1.5">
        <span className="sr-only">Vue calendrier</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value as CalendarViewMode)}
          className="h-9 rounded-md border border-rule bg-paper/85 px-2 text-xs font-mono text-ink shadow-sm hover:bg-paper transition-colors"
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>

      {/* Desktop : segmented control */}
      <div
        role="tablist"
        aria-label="Vue calendrier"
        className="hidden sm:inline-flex items-center gap-1 rounded-pill border border-rule bg-sage-alt/40 p-1"
      >
        {MODES.map((m) => {
          const isActive = value === m.value
          return (
            <button
              key={m.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(m.value)}
              disabled={!mounted}
              className={cn(
                'inline-flex items-center rounded-pill px-3.5 py-1 text-[11px] font-medium transition-all duration-fast',
                isActive
                  ? 'bg-[#0F1419] text-paper shadow-sm'
                  : 'text-ink-mute hover:text-ink hover:bg-paper/60',
              )}
            >
              {m.label}
            </button>
          )
        })}
      </div>
    </>
  )
}
