/**
 * KOVAS — Ligne bundle simple pour la page pricing simplifiée.
 *
 * Format minimal : "Annuaire Pro + Starter = 39€/mois (-19%) [Choisir]"
 * Pas de card riche, juste une ligne lisible alignée.
 */

import { formatPriceEurCompact } from '@/lib/format/price'
import type { BundleCombo } from '@/lib/pricing-plans'
import Link from 'next/link'

export interface PricingBundleRowProps {
  bundle: BundleCombo
}

export function PricingBundleRow({ bundle }: PricingBundleRowProps) {
  const savingsPct = Math.round(
    (bundle.monthlySavingsCents / bundle.individualMonthlyPriceCents) * 100,
  )

  return (
    <article className="group flex items-center gap-4 py-4 px-4 sm:px-6 border-t border-[#0B1D33]/[0.08] first:border-t-0 hover:bg-[#0B1D33]/[0.02] transition-colors">
      <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-baseline sm:gap-4">
        <p className="text-[15px] sm:text-[16px] font-medium text-[#0B1D33] truncate">
          {bundle.name}
        </p>
        <p className="font-mono text-[12px] text-[#0B1D33]/55">
          {bundle.includedPlanLabels.join(' + ')}
        </p>
      </div>

      <div className="flex items-baseline gap-2 shrink-0">
        <p className="font-serif italic text-[20px] sm:text-[22px] text-[#0B1D33] leading-none">
          {formatPriceEurCompact(bundle.monthlyPrice)}
        </p>
        <span className="font-mono text-[11px] text-[#0B1D33]/55">/ mois</span>
        {savingsPct > 0 ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#A3C920] font-semibold ml-1">
            -{savingsPct}%
          </span>
        ) : null}
      </div>

      <Link
        href={`/signup?bundle=${bundle.code}`}
        aria-label={`Choisir le bundle ${bundle.name}`}
        className="shrink-0 inline-flex items-center font-mono text-[12px] uppercase tracking-[0.1em] text-[#0B1D33] border-b border-[#0B1D33]/35 hover:border-[#0B1D33] transition-colors pb-0.5 font-semibold"
      >
        Choisir
      </Link>
    </article>
  )
}
