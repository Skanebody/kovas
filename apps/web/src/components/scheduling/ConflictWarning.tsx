'use client'

import { Button } from '@/components/ui/button'
import type { Conflict, ConflictResult } from '@/lib/scheduling/conflict-detector'
import { cn } from '@/lib/utils'
import { AlertTriangle, ArrowRightLeft, Clock } from 'lucide-react'

interface ConflictWarningProps {
  result: ConflictResult
  /** Si fourni : bouton pour forcer le créneau initial malgré le conflit. */
  onForceOriginal?: () => void
  className?: string
}

/**
 * Carte d'avertissement quand un conflit géographique est détecté.
 *
 * Border-left 4px amber (warning) ou red (critical). Liste chaque Conflict
 * avec son type lisible (FR), la mission précédente/suivante concernée, la
 * durée de trajet calculée et la marge effective restante.
 *
 * Le bouton "Forcer le créneau original" permet de bypass l'avertissement
 * (cas où le diagnostiqueur sait qu'il peut prendre un raccourci).
 */
export function ConflictWarning({ result, onForceOriginal, className }: ConflictWarningProps) {
  if (!result.hasConflict || result.conflicts.length === 0) return null

  const hasCritical = result.conflicts.some((c) => c.severity === 'critical')
  const borderClass = hasCritical ? 'border-l-danger' : 'border-l-status-amber'
  const headerClass = hasCritical ? 'text-danger' : 'text-[#7C3F0A]'

  return (
    <div
      className={cn(
        'rounded-lg border border-rule border-l-4 bg-paper p-4 space-y-3 shadow-glass-sm',
        borderClass,
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className={cn('size-4', headerClass)} />
        <h3 className={cn('text-[13px] font-semibold', headerClass)}>
          {hasCritical ? 'Conflit critique détecté' : 'Créneau serré — vérifiez votre planning'}
        </h3>
      </div>

      <ul className="space-y-2.5">
        {result.conflicts.map((conflict, i) => (
          <li
            key={`${conflict.type}-${i}`}
            className="text-[12px] text-ink space-y-1 pl-6 border-l-2 border-rule"
          >
            <p className="font-medium">{labelForType(conflict.type)}</p>
            {renderMission(conflict)}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-mute font-mono tabular-nums">
              {conflict.travelMin > 0 && (
                <span className="inline-flex items-center gap-1">
                  <ArrowRightLeft className="size-3" /> Trajet {conflict.travelMin} min
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" /> Marge {formatMargin(conflict.marginMin)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {onForceOriginal && (
        <div className="pt-1 border-t border-rule/60">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onForceOriginal}
            className="text-[11px]"
          >
            Forcer le créneau original malgré le conflit
          </Button>
        </div>
      )}
    </div>
  )
}

function labelForType(type: Conflict['type']): string {
  switch (type) {
    case 'too-tight-after-previous':
      return 'Trajet trop court après la mission précédente'
    case 'too-tight-before-next':
      return 'Trajet trop court avant la mission suivante'
    case 'overlap':
      return 'Chevauchement direct avec une mission existante'
  }
}

function renderMission(conflict: Conflict): React.ReactNode {
  const m = conflict.previousMission ?? conflict.nextMission
  if (!m) return null
  return (
    <p className="text-ink-mute">
      <span className="font-mono">{m.reference}</span> — {m.addressShort}
    </p>
  )
}

function formatMargin(min: number): string {
  if (min === 0) return '0 min'
  const sign = min < 0 ? '−' : '+'
  return `${sign}${Math.abs(min)} min`
}
