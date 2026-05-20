'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { DurationEstimate } from '@/lib/scheduling/duration-estimator'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, Loader2, Settings2, Timer } from 'lucide-react'
import { useState } from 'react'
import { DurationAdjustmentModal } from './DurationAdjustmentModal'
import { DurationBreakdown } from './DurationBreakdown'

interface DurationEstimatorProps {
  /** Estimation auto retournée par /api/scheduling/estimate-duration. */
  estimate: DurationEstimate | null
  /** Indicateur de fetch en cours (debounce + appel API). */
  loading: boolean
  /** Si fourni : durée forcée par l'utilisateur (badge "Ajustée"). */
  forcedMinutes: number | null
  /** Callback pour mettre à jour la durée forcée (null = revenir à l'auto). */
  onForcedChange: (forced: number | null) => void
  className?: string
}

/**
 * Carte signature de l'intelligence RDV : montre la durée arrondie en gros
 * (Instrument Serif italic), un breakdown collapsible par diagnostic, le
 * coefficient personnel s'il s'applique, et permet l'ajustement manuel.
 *
 * États :
 *  - loading       → spinner
 *  - !estimate     → message "Sélectionnez surface + diagnostics"
 *  - estimate ok   → affichage complet
 */
export function DurationEstimator({
  estimate,
  loading,
  forcedMinutes,
  onForcedChange,
  className,
}: DurationEstimatorProps) {
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)

  const isForced = forcedMinutes !== null
  const autoMinutes = estimate?.totalRounded ?? 0
  const displayMinutes = isForced ? forcedMinutes : autoMinutes

  return (
    <>
      <Card variant="opaque" padding="sm" className={cn('space-y-3', className)}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11px] font-mono uppercase tracking-[0.1em] text-ink-mute flex items-center gap-1.5">
            <Timer className="size-3.5" /> Durée estimée
          </span>
          <div className="flex items-center gap-2">
            {isForced && (
              <Badge variant="amber" className="text-[10px]">
                Ajustée manuellement
              </Badge>
            )}
            {estimate?.confidence && (
              <Badge variant="muted" className="text-[10px]">
                Fiabilité {labelForConfidence(estimate.confidence)}
              </Badge>
            )}
          </div>
        </div>

        {loading && !estimate ? (
          <div className="flex items-center gap-2 text-sm text-ink-mute py-4">
            <Loader2 className="size-4 animate-spin" /> Calcul en cours…
          </div>
        ) : !estimate ? (
          <p className="text-sm text-ink-mute py-2">
            Sélectionnez la surface, le type de bien et les diagnostics pour estimer la durée.
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-3">
              <span className="font-serif italic text-[64px] leading-none text-ink tabular-nums">
                {formatBig(displayMinutes)}
              </span>
              {loading && <Loader2 className="size-4 animate-spin text-ink-faint" />}
            </div>

            {estimate.personalAdjustment && (
              <p className="text-[12px] text-ink-mute italic">
                {estimate.personalAdjustment.reason} · facteur ×
                {estimate.personalAdjustment.factor.toFixed(2)}
              </p>
            )}

            <div className="flex items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setBreakdownOpen((v) => !v)}
                className="text-[11px]"
              >
                {breakdownOpen ? (
                  <>
                    <ChevronUp className="size-3.5" /> Masquer le détail
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-3.5" /> Voir le détail par diagnostic
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAdjustOpen(true)}
                className="text-[11px]"
              >
                <Settings2 className="size-3.5" /> Ajuster manuellement
              </Button>
            </div>

            {breakdownOpen && (
              <div className="pt-2 border-t border-rule/60">
                <DurationBreakdown
                  breakdown={estimate.breakdown}
                  bufferMinutes={estimate.bufferMinutes}
                />
              </div>
            )}
          </>
        )}
      </Card>

      <DurationAdjustmentModal
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        currentMinutes={displayMinutes || 60}
        autoEstimateMinutes={autoMinutes}
        onConfirm={onForcedChange}
      />
    </>
  )
}

function formatBig(min: number): string {
  if (min <= 0) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h}h${String(m).padStart(2, '0')}`
}

function labelForConfidence(c: 'high' | 'medium' | 'low'): string {
  switch (c) {
    case 'high':
      return 'élevée'
    case 'medium':
      return 'moyenne'
    case 'low':
      return 'faible'
  }
}
