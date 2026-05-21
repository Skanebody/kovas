'use client'

/**
 * KOVAS — Section pricing track réutilisable (Annuaire ou Logiciel).
 *
 * Cards verticales empilées full-width (pas de grille comparative) pour
 * forcer un scroll éducatif. Toggle mensuel / annuel sticky en bas de
 * section.
 */

import { formatPriceEurCompact } from '@/lib/format/price'
import type {
  AnnuairePlan,
  AnnuairePlanCode,
  LogicielPlan,
  LogicielPlanCode,
} from '@/lib/pricing-plans'
import { Check } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

type Billing = 'monthly' | 'annual'

interface AbstractPlan {
  readonly code: AnnuairePlanCode | LogicielPlanCode
  readonly name: string
  readonly tagline: string
  readonly monthlyPrice: number
  readonly annualPrice: number
  readonly features: readonly string[]
  readonly featured?: boolean
}

export interface PricingTrackSectionProps {
  /** Identifiant DOM (utilisé par les scroll smooth de QueVoulezVousSection) */
  id: 'section-annuaire' | 'section-logiciel'
  eyebrow: string
  title: string
  titleAccent: string
  description: string
  /** Tag visible sur la card featured (ex "RECOMMANDÉ") */
  featuredTag: string
  plans: readonly (AnnuairePlan | LogicielPlan)[]
  /** URL signup prefixé (ex "/signup?plan=") */
  signupPrefix: string
}

export function PricingTrackSection({
  id,
  eyebrow,
  title,
  titleAccent,
  description,
  featuredTag,
  plans,
  signupPrefix,
}: PricingTrackSectionProps) {
  const [billing, setBilling] = useState<Billing>('monthly')

  return (
    <section
      id={id}
      className="px-5 sm:px-12 py-20 sm:py-28 border-t border-[#0B1D33]/[0.08]"
    >
      <div className="max-w-[860px] mx-auto">
        <header className="text-center mb-12">
          <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#0B1D33]/55 font-semibold mb-4">
            {eyebrow}
          </p>
          <h2 className="font-sans font-semibold text-[32px] sm:text-[44px] md:text-[56px] leading-[1.04] tracking-[-0.03em] text-[#0B1D33] mb-5">
            {title}{' '}
            <span className="font-serif italic font-normal text-[#0B1D33]/72">
              {titleAccent}
            </span>
          </h2>
          <p className="text-[16px] sm:text-[17px] text-[#0B1D33]/72 leading-relaxed max-w-[660px] mx-auto">
            {description}
          </p>
        </header>

        <div className="space-y-4 sm:space-y-5">
          {plans.map((plan) => (
            <PricingTrackCard
              key={plan.code}
              plan={plan as AbstractPlan}
              billing={billing}
              featuredTag={featuredTag}
              signupPrefix={signupPrefix}
            />
          ))}
        </div>

        <div className="sticky bottom-4 z-10 mt-10 flex justify-center">
          <BillingToggle value={billing} onChange={setBilling} />
        </div>
      </div>
    </section>
  )
}

function PricingTrackCard({
  plan,
  billing,
  featuredTag,
  signupPrefix,
}: {
  plan: AbstractPlan
  billing: Billing
  featuredTag: string
  signupPrefix: string
}) {
  const isFree = plan.monthlyPrice === 0
  const priceCents = billing === 'annual' ? plan.annualPrice : plan.monthlyPrice
  const priceLabel = billing === 'annual' ? 'par an' : 'par mois'
  const showAnnualHint =
    billing === 'annual' && !isFree && plan.monthlyPrice > 0
      ? `Soit ${formatPriceEurCompact(Math.round(plan.annualPrice / 12))}/mois`
      : null

  return (
    <article
      className={`relative rounded-2xl border bg-white px-6 py-7 sm:px-8 sm:py-9 ${
        plan.featured
          ? 'border-[#D4F542] shadow-[0_8px_28px_rgba(212,245,66,0.18)]'
          : 'border-[#0B1D33]/[0.08]'
      }`}
    >
      {plan.featured ? (
        <span className="absolute top-4 right-4 inline-flex items-center font-mono text-[10px] uppercase tracking-[0.15em] text-[#0B1D33] bg-[#D4F542] px-2.5 py-1 rounded-full font-semibold">
          {featuredTag}
        </span>
      ) : null}

      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#0B1D33]/55 font-medium mb-4">
        {plan.name}
      </p>

      <div className="flex items-baseline gap-2 mb-3">
        <p className="font-serif italic font-normal text-[#0B1D33] text-[40px] sm:text-[48px] leading-none tracking-tight">
          {isFree ? 'Gratuit' : formatPriceEurCompact(priceCents)}
        </p>
        {!isFree ? (
          <span className="font-mono text-[12px] text-[#0B1D33]/55">
            {priceLabel}
          </span>
        ) : null}
      </div>
      {showAnnualHint ? (
        <p className="font-mono text-[11px] text-[#0B1D33]/55 mb-4">
          {showAnnualHint}
        </p>
      ) : null}

      <p className="text-[14px] sm:text-[15px] text-[#0B1D33]/72 leading-relaxed mb-6">
        {plan.tagline}
      </p>

      <ul className="space-y-2.5 mb-7">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5">
            <Check
              aria-hidden
              className="size-4 text-[#A3C920] shrink-0 mt-0.5"
              strokeWidth={2.5}
            />
            <span className="text-[14px] text-[#0B1D33]/85 leading-relaxed">
              {feature}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href={`${signupPrefix}${plan.code}`}
        aria-label={`Choisir le forfait ${plan.name}`}
        className={`inline-flex items-center justify-center gap-2 w-full sm:w-auto px-7 py-3.5 rounded-full text-[14px] font-semibold transition-all duration-150 ${
          plan.featured
            ? 'bg-[#D4F542] text-[#0B1D33] hover:bg-[#A3C920] hover:-translate-y-px shadow-[0_6px_18px_rgba(212,245,66,0.35)]'
            : 'bg-white text-[#0B1D33] border border-[#0B1D33]/30 hover:border-[#0B1D33]'
        }`}
      >
        {isFree ? 'Commencer gratuitement' : `Choisir ${plan.name}`}
      </Link>
    </article>
  )
}

function BillingToggle({
  value,
  onChange,
}: {
  value: Billing
  onChange: (b: Billing) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Cycle de facturation"
      className="inline-flex items-center gap-1 p-1 rounded-full bg-[#0B1D33] text-white shadow-[0_8px_24px_rgba(11,29,51,0.25)]"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'monthly'}
        onClick={() => onChange('monthly')}
        className={`px-5 py-2 rounded-full text-[12px] font-medium transition-colors ${
          value === 'monthly'
            ? 'bg-white text-[#0B1D33]'
            : 'text-white/85 hover:text-white'
        }`}
      >
        Mensuel
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'annual'}
        onClick={() => onChange('annual')}
        className={`px-5 py-2 rounded-full text-[12px] font-medium transition-colors ${
          value === 'annual'
            ? 'bg-[#D4F542] text-[#0B1D33]'
            : 'text-white/85 hover:text-white'
        }`}
      >
        Annuel
        <span className="ml-2 font-mono text-[10px] opacity-75">-15%</span>
      </button>
    </div>
  )
}
