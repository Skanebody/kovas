/**
 * KOVAS — PriceEstimator
 *
 * Card hero "prix indicatif" affichant un `PricingEstimate` complet.
 * - Si `!hasPricingConfigured` → délègue à <EmptyPricingState>.
 * - Sinon : eyebrow mono "Prix indicatif", KPI hero Instrument Serif italic
 *   (total selon `displayMode`), breakdown détaillé, vatNote si franchise.
 *
 * Ce composant est PURE (présentation). L'orchestration (fetch /api/pricing
 * /estimate, debounce, etc.) est laissée au parent (dossier-form / autre).
 */

import { Card } from '@/components/ui/card'
import type { PricingEstimate } from '@/lib/pricing/pricing-calculator'
import { cn } from '@/lib/utils'
import { EmptyPricingState } from './empty-pricing-state'
import { PriceBreakdown } from './price-breakdown'

interface PriceEstimatorProps {
  estimate: PricingEstimate
  /** Slot action droite (ex: bouton "Ajuster", "Recalculer"...) */
  action?: React.ReactNode
  /** Si présent, override le titre eyebrow par défaut. */
  eyebrow?: string
  className?: string
  /** Microcopy custom si pas configuré (passé à EmptyPricingState). */
  emptyMessage?: string
}

function formatEur(amount: number): string {
  if (Number.isInteger(amount)) return `${amount} €`
  return `${amount.toFixed(2).replace('.', ',')} €`
}

function formatPercent(rate: number): string {
  const pct = Math.round(rate * 1000) / 10
  if (Number.isInteger(pct)) return `${pct}%`
  return `${pct.toFixed(1).replace('.', ',')}%`
}

export function PriceEstimator({
  estimate,
  action,
  eyebrow,
  className,
  emptyMessage,
}: PriceEstimatorProps) {
  if (!estimate.hasPricingConfigured) {
    return (
      <Card variant="opaque" padding="default" className={className}>
        <EmptyPricingState message={emptyMessage} />
      </Card>
    )
  }

  // Détermine quelle valeur afficher en hero selon displayMode.
  const showHt = estimate.displayMode === 'ht_only' || estimate.displayMode === 'ht_and_ttc'
  const showTtc = estimate.displayMode === 'ttc_only' || estimate.displayMode === 'ht_and_ttc'

  // KPI hero principal : on prend TTC si dispo et applicable, sinon HT.
  const heroAmount = estimate.vatApplicable && showTtc ? estimate.totalTtc : estimate.totalHt
  const heroSuffix = estimate.vatApplicable && showTtc ? 'TTC' : 'HT'

  return (
    <Card variant="opaque" padding="default" className={cn('space-y-5', className)}>
      {/* Header eyebrow + action */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
            {eyebrow ?? 'Prix indicatif'}
          </p>
          <p className="text-[11px] text-ink-faint">
            Pour aider la prise de RDV — non contractuel.
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {/* KPI hero — Instrument Serif italic */}
      <div className="space-y-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-serif italic text-3xl md:text-[2rem] text-ink leading-none tracking-tight tabular-nums">
            {formatEur(heroAmount)}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
            {heroSuffix}
          </span>
        </div>
        {/* Ligne secondaire : si on affiche les deux, on rappelle l'autre valeur */}
        {estimate.displayMode === 'ht_and_ttc' && estimate.vatApplicable && (
          <p className="text-[12px] text-ink-mute tabular-nums">
            soit {formatEur(estimate.totalHt)} HT · TVA {formatPercent(estimate.vatRate)} ={' '}
            {formatEur(estimate.totalTva)}
          </p>
        )}
        {!estimate.vatApplicable && showHt && (
          <p className="text-[12px] text-ink-mute tabular-nums">
            soit {formatEur(estimate.totalHt)} HT
          </p>
        )}
      </div>

      {/* VAT note (franchise) */}
      {estimate.vatNote && <p className="text-[11px] italic text-ink-mute">{estimate.vatNote}</p>}

      {/* Breakdown */}
      <div className="pt-4 border-t border-rule/60">
        <PriceBreakdown
          itemizedPrices={estimate.itemizedPrices}
          itemizedSubtotalHt={estimate.itemizedSubtotalHt}
          applicablePack={estimate.applicablePack}
          travelFeesHt={estimate.travelFeesHt}
          travelFeesDescription={estimate.travelFeesDescription}
          majorationsHt={estimate.majorationsHt}
          majorationsDetails={estimate.majorationsDetails}
        />
      </div>
    </Card>
  )
}
