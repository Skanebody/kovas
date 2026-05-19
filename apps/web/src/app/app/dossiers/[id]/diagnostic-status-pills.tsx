'use client'

import { cn } from '@/lib/utils'

interface DiagnosticPill {
  missionId: string
  type: string
  label: string
  percentage: number
}

interface DiagnosticStatusPillsProps {
  pills: DiagnosticPill[]
}

function statusColor(pct: number): {
  dot: string
  text: string
  border: string
  bg: string
} {
  if (pct >= 100)
    return {
      dot: 'bg-accent-blue',
      text: 'text-ink',
      border: 'border-accent-blue/30',
      bg: 'bg-accent-blue/5',
    }
  if (pct >= 75)
    return {
      dot: 'bg-accent-green',
      text: 'text-ink',
      border: 'border-accent-green/30',
      bg: 'bg-accent-green/5',
    }
  if (pct >= 25)
    return {
      dot: 'bg-accent-orange',
      text: 'text-ink',
      border: 'border-accent-orange/30',
      bg: 'bg-accent-orange/5',
    }
  return {
    dot: 'bg-accent-red',
    text: 'text-ink',
    border: 'border-accent-red/30',
    bg: 'bg-accent-red/5',
  }
}

/**
 * Barre de pills statut diagnostics — scroll horizontal sur mobile.
 * Tap : scroll vers la card mission correspondante (#mission-{id}).
 * cf. spec dossier-allegement-visuel 2026-05-18.
 */
export function DiagnosticStatusPills({ pills }: DiagnosticStatusPillsProps) {
  if (pills.length === 0) return null

  function scrollTo(id: string) {
    const el = document.getElementById(`mission-${id}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
      {pills.map((p) => {
        const colors = statusColor(p.percentage)
        return (
          <button
            key={p.missionId}
            type="button"
            onClick={() => scrollTo(p.missionId)}
            className={cn(
              'shrink-0 inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-xs transition-colors',
              colors.border,
              colors.bg,
              colors.text,
              'hover:scale-[1.02]',
            )}
            aria-label={`Diagnostic ${p.label}, ${p.percentage}% complété`}
          >
            <span className={cn('size-2 rounded-full', colors.dot)} aria-hidden />
            <span className="font-medium">{p.label}</span>
            <span className="text-ink-mute tabular-nums">{p.percentage}%</span>
          </button>
        )
      })}
    </div>
  )
}
