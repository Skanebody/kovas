/**
 * KOVAS — PriceBreakdown
 *
 * Table compacte des lignes itemized + pack appliqué (avec savings) + travel
 * fees + majorations. Présenté en dessous du KPI hero dans PriceEstimator.
 *
 * Source : `PricingEstimate.itemizedPrices`, `applicablePack`, `travelFeesHt`,
 * `majorationsDetails`. Le total est rendu séparément dans PriceEstimator.
 */

import type { Majoration } from '@/lib/pricing/majorations-calculator'
import type { ApplicablePack } from '@/lib/pricing/pack-detector'
import type { PriceLineItem } from '@/lib/pricing/pricing-calculator'
import { cn } from '@/lib/utils'

interface PriceBreakdownProps {
  itemizedPrices: PriceLineItem[]
  itemizedSubtotalHt: number
  applicablePack?: ApplicablePack
  travelFeesHt: number
  travelFeesDescription: string
  majorationsHt: number
  majorationsDetails: Majoration[]
  className?: string
}

const DIAGNOSTIC_LABEL: Record<string, string> = {
  DPE: 'DPE',
  AMIANTE: 'Amiante',
  PLOMB: 'Plomb (CREP)',
  GAZ: 'Gaz',
  ELEC: 'Électricité',
  TERMITES: 'Termites',
  CARREZ: 'Carrez',
  BOUTIN: 'Boutin',
  ERP: 'ERP',
}

function formatEur(amount: number): string {
  if (Number.isInteger(amount)) return `${amount} €`
  return `${amount.toFixed(2).replace('.', ',')} €`
}

function formatPercent(percent: number): string {
  if (Number.isInteger(percent)) return `${percent}%`
  return `${percent.toFixed(1).replace('.', ',')}%`
}

function formatModulation(mod: number): string {
  return `× ${mod.toFixed(2).replace('.', ',')}`
}

export function PriceBreakdown({
  itemizedPrices,
  itemizedSubtotalHt,
  applicablePack,
  travelFeesHt,
  travelFeesDescription,
  majorationsHt,
  majorationsDetails,
  className,
}: PriceBreakdownProps) {
  const hasPack = !!applicablePack
  const hasTravel = travelFeesHt > 0
  const hasMajorations = majorationsDetails.length > 0

  return (
    <div className={cn('space-y-3', className)}>
      {/* Itemized diagnostics */}
      <div className="space-y-1.5">
        {itemizedPrices.map((line) => (
          <div
            key={line.diagnostic}
            className="flex items-baseline justify-between gap-3 text-[13px]"
          >
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-ink truncate">
                {DIAGNOSTIC_LABEL[line.diagnostic] ?? line.diagnostic}
              </span>
              {line.appliedModulation !== 1 && (
                <span className="font-mono text-[10px] text-ink-faint shrink-0">
                  {formatModulation(line.appliedModulation)}
                </span>
              )}
            </div>
            <span className="font-mono text-[12px] tabular-nums text-ink shrink-0">
              {formatEur(line.priceHt)}
            </span>
          </div>
        ))}

        {/* Sous-total itemized */}
        <div className="flex items-baseline justify-between gap-3 pt-2 mt-1 border-t border-rule/60">
          <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-ink-mute">
            Sous-total
          </span>
          <span
            className={cn(
              'font-mono text-[12px] tabular-nums shrink-0',
              hasPack ? 'text-ink-faint line-through' : 'text-ink font-semibold',
            )}
          >
            {formatEur(itemizedSubtotalHt)}
          </span>
        </div>
      </div>

      {/* Pack appliqué (substitution) */}
      {applicablePack && (
        <div className="rounded-md bg-chartreuse-soft px-3 py-2 space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[12px] font-semibold text-ink">{applicablePack.packName}</span>
            <span className="font-mono text-[12px] tabular-nums font-semibold text-ink shrink-0">
              {formatEur(applicablePack.packPriceHt)}
            </span>
          </div>
          {applicablePack.savingsVsItemized > 0 && (
            <p className="text-[11px] text-ink-mute">
              Économie {formatEur(applicablePack.savingsVsItemized)} (
              {formatPercent(applicablePack.savingsPercent)})
            </p>
          )}
        </div>
      )}

      {/* Frais de déplacement */}
      {hasTravel && (
        <div className="flex items-baseline justify-between gap-3 text-[13px] pt-2 border-t border-rule/60">
          <div className="flex flex-col min-w-0">
            <span className="text-ink">Déplacement</span>
            <span className="text-[11px] text-ink-faint truncate">{travelFeesDescription}</span>
          </div>
          <span className="font-mono text-[12px] tabular-nums text-ink shrink-0">
            {formatEur(travelFeesHt)}
          </span>
        </div>
      )}

      {/* Majorations */}
      {hasMajorations && (
        <div
          className={cn('space-y-1.5 text-[13px]', !hasTravel && 'pt-2 border-t border-rule/60')}
        >
          {majorationsDetails.map((m) => (
            <div key={m.kind} className="flex items-baseline justify-between gap-3">
              <span className="text-ink">{m.label}</span>
              <span className="font-mono text-[12px] tabular-nums text-ink shrink-0">
                +{formatEur(m.amountHt)}
              </span>
            </div>
          ))}
          {majorationsHt > 0 && majorationsDetails.length > 1 && (
            <div className="flex items-baseline justify-between gap-3 pt-1">
              <span className="text-[11px] font-mono uppercase tracking-[0.08em] text-ink-mute">
                Total majorations
              </span>
              <span className="font-mono text-[12px] tabular-nums font-semibold text-ink shrink-0">
                {formatEur(majorationsHt)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
