'use client'

/**
 * TransitionAlert — bulle système affichée dans le flux chat quand le
 * tracker détecte une transition de pièce sans avoir couvert les items
 * per_room obligatoires de la précédente.
 *
 * UX :
 *  - bordure gauche warning (2px)
 *  - label-mono "Garde-fou — transition pièce"
 *  - liste items manquants dans la pièce quittée
 *  - 2 CTA : "Compléter maintenant" (chartreuse) · "Rappeler plus tard" (ghost)
 */

import { Button } from '@/components/ui/button'
import type { RoomTransitionEvent } from '@/lib/local-ai/checklist-tracker'
import { ROOM_LABEL_FR } from '@/lib/local-ai/room-transition-detector'
import { cn } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

interface TransitionAlertProps {
  transition: RoomTransitionEvent
  onComplete: () => void
  onDismiss: () => void
  className?: string
}

export function TransitionAlert({
  transition,
  onComplete,
  onDismiss,
  className,
}: TransitionAlertProps) {
  const fromLabel = transition.from ? ROOM_LABEL_FR[transition.from] : null
  const toLabel = ROOM_LABEL_FR[transition.to]
  const gaps = transition.per_room_gaps

  return (
    <div
      className={cn(
        'relative bg-paper border border-rule border-l-2 border-l-warning rounded-lg shadow-sm',
        'p-4 animate-fade-in',
        className,
      )}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="size-8 rounded-full bg-warning/10 flex items-center justify-center shrink-0">
          <AlertTriangle className="size-4 text-warning" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <p className="label-mono text-ink-mute mb-1">Garde-fou — transition pièce</p>
          <p className="text-[14px] font-medium text-ink leading-snug mb-2">
            {fromLabel ? (
              <>
                Vous passez de <strong className="font-semibold">{fromLabel}</strong> à{' '}
                <strong className="font-semibold">{toLabel}</strong>.
              </>
            ) : (
              <>
                Vous entrez dans <strong className="font-semibold">{toLabel}</strong>.
              </>
            )}
          </p>
          {fromLabel && gaps.length > 0 ? (
            <>
              <p className="text-[13px] text-ink-soft mb-2 leading-snug">
                {gaps.length} élément{gaps.length > 1 ? 's' : ''} à compléter pour {fromLabel} :
              </p>
              <ul className="space-y-1 mb-3">
                {gaps.slice(0, 5).map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-2 text-[13px] text-ink-soft"
                  >
                    <span
                      className="size-1.5 rounded-full bg-warning mt-1.5 shrink-0"
                      aria-hidden
                    />
                    <span className="leading-snug">{item.description_short}</span>
                  </li>
                ))}
                {gaps.length > 5 && (
                  <li className="text-[12px] text-ink-mute pl-3.5">
                    + {gaps.length - 5} autre{gaps.length - 5 > 1 ? 's' : ''}…
                  </li>
                )}
              </ul>
              <div className="flex gap-2">
                <Button type="button" variant="accent" size="sm" onClick={onComplete}>
                  Compléter maintenant
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
                  Rappeler plus tard
                </Button>
              </div>
            </>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="text-ink-mute"
            >
              Continuer la capture
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
