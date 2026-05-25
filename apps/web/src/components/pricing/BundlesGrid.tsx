'use client'

// Type B2 dependency — pricing-plans.ts refonte by parallel agent
import { BUNDLES, type Bundle } from '@/lib/pricing-plans'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import type { BillingCycle } from './PricingToggle'

interface BundlesGridProps {
  billing: BillingCycle
}

/**
 * Grille des Bundles Annuaire + KOVAS (Spec §4).
 *
 * Affiche l'économie mensuelle (-9 à -99 €) en chartreuse pour visualiser le
 * gain. CTA Stripe avec `plan=<bundle_code>`.
 *
 * Mobile-first : 1 col → sm:2 cols → lg:5 cols.
 */
export function BundlesGrid({ billing }: BundlesGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-stretch">
      {BUNDLES.map((bundle) => (
        <BundleCard key={bundle.code} bundle={bundle} billing={billing} />
      ))}
    </div>
  )
}

function BundleCard({ bundle, billing }: { bundle: Bundle; billing: BillingCycle }) {
  const monthlyEuros = Math.round(bundle.monthlyPrice / 100)
  const annualEuros = Math.round(bundle.annualPrice / 100)
  const individualEuros = Math.round(bundle.individualMonthlyPriceCents / 100)
  const savingsEuros = Math.round(bundle.monthlySavingsCents / 100)
  const displayPrice = billing === 'annual' ? Math.round(annualEuros / 12) : monthlyEuros

  return (
    <article
      className={cn(
        'relative flex flex-col rounded-[24px] p-6 transition-all duration-200',
        bundle.featured === true
          ? 'bg-[#0F1419] text-white border border-[#0F1419] lg:-translate-y-2'
          : 'bg-white text-[#0F1419] border border-[#0F1419]/[0.08] hover:border-[#0F1419]/35',
      )}
    >
      <span
        className={cn(
          'absolute -top-3 left-1/2 -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.18em] font-bold px-3.5 py-1.5 rounded-full whitespace-nowrap',
          'bg-chartreuse text-[#0F1419]',
        )}
        aria-label={`Économie de ${savingsEuros} euros par mois`}
      >
        − {savingsEuros} € / mois
      </span>

      <p
        className={cn(
          'font-mono text-[12px] uppercase tracking-[0.16em] font-semibold mb-2 mt-3',
          bundle.featured === true ? 'text-white/72' : 'text-[#0F1419]/55',
        )}
      >
        {bundle.name}
      </p>
      <p
        className={cn(
          'text-[13px] leading-snug mb-5 min-h-[40px]',
          bundle.featured === true ? 'text-white/90' : 'text-[#0F1419]/72',
        )}
      >
        {bundle.tagline}
      </p>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-serif italic font-normal text-[48px] leading-none tracking-[-0.03em]">
          {displayPrice}
        </span>
        <span
          className={cn(
            'text-sm',
            bundle.featured === true ? 'text-white/72' : 'text-[#0F1419]/55',
          )}
        >
          € HT / mois
        </span>
      </div>
      <p
        className={cn(
          'text-[12px] mb-5',
          bundle.featured === true ? 'text-white/72' : 'text-[#0F1419]/55',
        )}
      >
        <span className="line-through opacity-60">{individualEuros} €</span> séparément{' '}
        {billing === 'annual' ? `· ${annualEuros} € HT / an` : `· ${annualEuros} € en annuel`}
      </p>

      <div
        className={cn(
          'h-px mb-5',
          bundle.featured === true ? 'bg-white/15' : 'bg-[#0F1419]/[0.08]',
        )}
        aria-hidden
      />

      <ul
        className={cn(
          'text-[13px] leading-relaxed mb-6 space-y-1.5 flex-1',
          bundle.featured === true ? 'text-white/90' : 'text-[#0F1419]/72',
        )}
      >
        {bundle.includedPlanLabels.map((label) => (
          <li key={label} className="pl-[22px] relative">
            <span
              aria-hidden
              className={cn(
                'absolute left-1 top-[8px] block w-2 h-1 border-l-2 border-b-2 -rotate-45',
                bundle.featured === true ? 'border-chartreuse' : 'border-[#95B11A]',
              )}
            />
            <span>{label}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-2">
        <Link
          href={`/api/stripe/checkout?plan=${bundle.code}&cycle=${billing}`}
          aria-label={`Choisir le bundle ${bundle.name}`}
          className={cn(
            'flex items-center justify-center gap-2 w-full py-3.5 px-5 rounded-[16px] text-[14px] font-semibold transition-all duration-150 hover:-translate-y-px',
            bundle.featured === true
              ? 'bg-chartreuse text-[#0F1419] hover:bg-chartreuse-deep'
              : 'bg-[#0F1419] text-white hover:bg-[#0F1419]/90',
          )}
        >
          Choisir
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </article>
  )
}
