'use client'

import { PRICING_PLANS, getAnnualPrice, type PricingPlan } from '@/lib/pricing-plans'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

/**
 * Toggle Mensuel / Annuel + grille des 5 tiers (refonte P9 — 2026-05-28).
 *
 * Nouveau modèle : missions ILLIMITÉES sous fair-use cap. Aucun affichage de
 * surplus. Le fair-use cap est visible explicitement sur chaque carte.
 *
 * Layout :
 *   - Mobile : stack vertical 1 colonne
 *   - sm : 2 colonnes
 *   - lg : 5 colonnes compactes
 *
 * Le bouton "Démarrer en X" mène à `/pricing/checkout?plan=X&billing=Y`.
 */
export function PricingTiersGrid() {
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')

  return (
    <div>
      <BillingToggle value={billing} onChange={setBilling} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-stretch">
        {PRICING_PLANS.map((tier) => (
          <TierCard key={tier.code} tier={tier} billing={billing} />
        ))}
      </div>
    </div>
  )
}

function TierCard({ tier, billing }: { tier: PricingPlan; billing: 'monthly' | 'annual' }) {
  const annualPrice = getAnnualPrice(tier)
  const monthlyEquivalent = Math.round(annualPrice / 12)
  const price = billing === 'annual' ? monthlyEquivalent : tier.monthlyPrice
  const subline =
    billing === 'annual'
      ? `${annualPrice} € HT / an (2 mois offerts)`
      : `${annualPrice} € en annuel`

  const featured = tier.featured === true

  return (
    <article
      className={cn(
        'relative flex flex-col rounded-[24px] p-6 transition-all duration-200',
        featured
          ? 'bg-[#0F1419] text-white border border-[#0F1419] lg:-translate-y-2 sm:col-span-2 lg:col-span-1'
          : 'bg-white text-[#0F1419] border border-[#0F1419]/[0.08] hover:border-[#0F1419]/35',
      )}
    >
      {featured && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 bg-chartreuse text-[#0F1419] font-mono text-[11px] uppercase tracking-[0.18em] font-bold px-3.5 py-1.5 rounded-full whitespace-nowrap"
          aria-label="Tier recommandé"
        >
          Populaire
        </span>
      )}

      {/* HEADER : nom + tagline 2 lignes */}
      <p
        className={cn(
          'font-mono text-[12px] uppercase tracking-[0.16em] font-semibold mb-2',
          featured ? 'text-white/60' : 'text-[#0F1419]/55',
        )}
      >
        {tier.name}
      </p>
      <p
        className={cn(
          'text-[13px] leading-snug mb-5 min-h-[40px]',
          featured ? 'text-white/90' : 'text-[#0F1419]/72',
        )}
      >
        {tier.tagline}
      </p>

      {/* PRIX */}
      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-serif italic font-normal text-[56px] leading-none tracking-[-0.03em]">
          {price}
        </span>
        <span className={cn('text-sm', featured ? 'text-white/60' : 'text-[#0F1419]/55')}>
          € HT / mois
        </span>
      </div>
      <p
        className={cn(
          'text-[12px] mb-5',
          featured ? 'text-white/60' : 'text-[#0F1419]/55',
        )}
      >
        {subline}
      </p>

      {/* SÉPARATEUR */}
      <div
        className={cn('h-px mb-5', featured ? 'bg-white/15' : 'bg-[#0F1419]/[0.08]')}
        aria-hidden
      />

      {/* MISSIONS ILLIMITÉES + fair-use visible */}
      <div
        className={cn(
          'mb-4 px-3 py-2.5 rounded-[12px]',
          featured ? 'bg-white/[0.06]' : 'bg-[#F5F7F4]',
        )}
      >
        <p
          className={cn(
            'font-semibold text-[14px] leading-tight',
            featured ? 'text-white' : 'text-[#0F1419]',
          )}
        >
          Missions illimitées
        </p>
        <p
          className={cn(
            'text-[11px] mt-1 leading-snug',
            featured ? 'text-white/72' : 'text-[#0F1419]/72',
          )}
        >
          Jusqu'à {tier.caps.missions} / mois (au-delà : on en discute)
        </p>
      </div>

      {/* FEATURES BULLETS */}
      <ul
        className={cn(
          'text-[13px] leading-relaxed mb-6 space-y-1.5 flex-1',
          featured ? 'text-white/90' : 'text-[#0F1419]/72',
        )}
      >
        {tier.features.slice(0, 5).map((feature) => (
          <Feature key={feature} featured={featured}>
            {feature}
          </Feature>
        ))}
      </ul>

      {/* CTA EN BAS */}
      <div className="mt-auto pt-2">
        <Link
          href={`/pricing/checkout?plan=${tier.code}&billing=${billing}`}
          className={cn(
            'flex items-center justify-center gap-2 w-full py-3.5 px-5 rounded-[16px] text-[14px] font-semibold transition-all duration-150 hover:-translate-y-px',
            featured
              ? 'bg-chartreuse text-[#0F1419] hover:bg-chartreuse-deep'
              : 'bg-[#0F1419] text-white hover:bg-[#0F1419]/90',
          )}
        >
          Démarrer l'essai 14j
          <ArrowRight className="size-4" />
        </Link>
        <p
          className={cn(
            'text-center mt-3 text-[11px] leading-snug',
            featured ? 'text-white/60' : 'text-[#0F1419]/55',
          )}
        >
          Sans CB · Résiliable à tout moment
        </p>
      </div>
    </article>
  )
}

function Feature({
  featured,
  children,
}: {
  featured: boolean
  children: React.ReactNode
}) {
  return (
    <li className="pl-[22px] relative">
      <span
        aria-hidden
        className={cn(
          'absolute left-1 top-[8px] block w-2 h-1 border-l-2 border-b-2 -rotate-45',
          featured ? 'border-chartreuse' : 'border-[#95B11A]',
        )}
      />
      <span>{children}</span>
    </li>
  )
}

function BillingToggle({
  value,
  onChange,
}: {
  value: 'monthly' | 'annual'
  onChange: (v: 'monthly' | 'annual') => void
}) {
  return (
    <div className="text-center mb-12 mx-auto max-w-xl">
      <div
        role="tablist"
        aria-label="Période de facturation"
        className="inline-flex bg-white border border-[#0F1419]/[0.08] rounded-full p-1 gap-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={value === 'monthly'}
          onClick={() => onChange('monthly')}
          className={cn(
            'px-5 py-2.5 rounded-full text-sm font-medium transition-colors duration-150',
            value === 'monthly'
              ? 'bg-[#0F1419] text-white'
              : 'text-[#0F1419]/55 hover:text-[#0F1419]',
          )}
        >
          Mensuel
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={value === 'annual'}
          onClick={() => onChange('annual')}
          className={cn(
            'px-5 py-2.5 rounded-full text-sm font-medium transition-colors duration-150 inline-flex items-center gap-2',
            value === 'annual'
              ? 'bg-[#0F1419] text-white'
              : 'text-[#0F1419]/55 hover:text-[#0F1419]',
          )}
        >
          Annuel
          <span className="bg-chartreuse text-[#0F1419] font-mono text-[10px] uppercase tracking-[0.08em] font-bold px-2 py-0.5 rounded-full">
            2 mois offerts
          </span>
        </button>
      </div>
      <p className="mt-3.5 text-[13px] text-[#0F1419]/55 leading-normal">
        Mensuel : résiliable à tout moment. Annuel : 10 mois payés sur 12.
      </p>
    </div>
  )
}
