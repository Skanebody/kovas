'use client'

// Type B2 dependency — pricing-plans.ts refonte by parallel agent
import { LOGICIEL_PLANS, type LogicielPlan, type LogicielPlanCode } from '@/lib/pricing-plans'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import type { BillingCycle } from './PricingToggle'

interface LogicielTrackGridProps {
  billing: BillingCycle
}

/**
 * Grille des 5 tiers KOVAS (SaaS B2B diagnostiqueurs).
 *
 * Spec : `docs/pricing/v3-dual-track-spec.md` §3. Tier `logiciel_active`
 * (59€/mo) flaggué featured.
 * Mobile-first : 1 col → sm:2 cols → lg:5 cols.
 */
export function LogicielTrackGrid({ billing }: LogicielTrackGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-stretch">
      {LOGICIEL_PLANS.map((plan) => (
        <LogicielCard key={plan.code} plan={plan} billing={billing} />
      ))}
    </div>
  )
}

function LogicielCard({
  plan,
  billing,
}: {
  plan: LogicielPlan
  billing: BillingCycle
}) {
  const isFree = plan.code === 'essai' || plan.code === 'logiciel_free'
  const monthlyEuros = Math.round(plan.monthlyPrice / 100)
  const annualEuros = Math.round(plan.annualPrice / 100)
  const displayPrice = billing === 'annual' ? Math.round(annualEuros / 12) : monthlyEuros
  const subline = isFree
    ? 'Essai 30 jours · CB enregistrée, débit auto à J+30'
    : billing === 'annual'
      ? `${annualEuros} € HT / an · 2 mois offerts`
      : `${annualEuros} € en annuel`

  const ctaHref = ctaHrefFor(plan.code, billing)
  const ctaLabel = ctaLabelFor(plan.code)

  return (
    <article
      className={cn(
        'relative flex flex-col rounded-[24px] p-6 transition-all duration-200',
        plan.featured === true
          ? 'bg-[#0F1419] text-white border border-[#0F1419] lg:-translate-y-2 sm:col-span-2 lg:col-span-1'
          : 'bg-white text-[#0F1419] border border-[#0F1419]/[0.08] hover:border-[#0F1419]/35',
      )}
    >
      {plan.featured === true && (
        <span
          className="absolute -top-3 left-1/2 -translate-x-1/2 bg-chartreuse text-[#0F1419] font-mono text-[11px] uppercase tracking-[0.18em] font-bold px-3.5 py-1.5 rounded-full whitespace-nowrap"
          aria-label="Tier recommandé"
        >
          Populaire
        </span>
      )}

      <p
        className={cn(
          'font-mono text-[12px] uppercase tracking-[0.16em] font-semibold mb-2',
          plan.featured === true ? 'text-white/72' : 'text-[#0F1419]/55',
        )}
      >
        {plan.name}
      </p>
      <p
        className={cn(
          'text-[13px] leading-snug mb-5 min-h-[40px]',
          plan.featured === true ? 'text-white/90' : 'text-[#0F1419]/72',
        )}
      >
        {plan.tagline}
      </p>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="font-serif italic font-normal text-[56px] leading-none tracking-[-0.03em]">
          {displayPrice}
        </span>
        <span
          className={cn('text-sm', plan.featured === true ? 'text-white/72' : 'text-[#0F1419]/55')}
        >
          € HT / mois
        </span>
      </div>
      <p
        className={cn(
          'text-[12px] mb-5',
          plan.featured === true ? 'text-white/72' : 'text-[#0F1419]/55',
        )}
      >
        {subline}
      </p>

      <div
        className={cn('h-px mb-5', plan.featured === true ? 'bg-white/15' : 'bg-[#0F1419]/[0.08]')}
        aria-hidden
      />

      <div
        className={cn(
          'mb-4 px-3 py-2.5 rounded-[12px]',
          plan.featured === true ? 'bg-white/[0.06]' : 'bg-[#F5F7F4]',
        )}
      >
        <p
          className={cn(
            'font-semibold text-[14px] leading-tight',
            plan.featured === true ? 'text-white' : 'text-[#0F1419]',
          )}
        >
          {plan.code === 'cabinet_plus' || plan.code === 'logiciel_enterprise'
            ? 'Missions illimitées'
            : `${plan.caps.missions} missions / mois`}
        </p>
        <p
          className={cn(
            'text-[11px] mt-1 leading-snug',
            plan.featured === true ? 'text-white/72' : 'text-[#0F1419]/72',
          )}
        >
          {plan.caps.users === 1 ? '1 utilisateur' : `${plan.caps.users} utilisateurs inclus`} ·{' '}
          {plan.caps.storageGb} Go stockage
        </p>
      </div>

      <ul
        className={cn(
          'text-[13px] leading-relaxed mb-6 space-y-1.5 flex-1',
          plan.featured === true ? 'text-white/90' : 'text-[#0F1419]/72',
        )}
      >
        {plan.features.slice(0, 5).map((feature) => (
          <FeatureItem key={feature} featured={plan.featured === true}>
            {feature}
          </FeatureItem>
        ))}
      </ul>

      <div className="mt-auto pt-2">
        <Link
          href={ctaHref}
          aria-label={`${ctaLabel} — ${plan.name}`}
          className={cn(
            'flex items-center justify-center gap-2 w-full py-3.5 px-5 rounded-[16px] text-[14px] font-semibold transition-all duration-150 hover:-translate-y-px',
            plan.featured === true
              ? 'bg-chartreuse text-[#0F1419] hover:bg-chartreuse-deep'
              : isFree
                ? 'bg-white text-[#0F1419] border border-[#0F1419]/35 hover:border-[#0F1419]'
                : 'bg-[#0F1419] text-white hover:bg-[#0F1419]/90',
          )}
        >
          {ctaLabel}
          <ArrowRight className="size-4" />
        </Link>
        <p
          className={cn(
            'text-center mt-3 text-[11px] leading-snug',
            plan.featured === true ? 'text-white/72' : 'text-[#0F1419]/55',
          )}
        >
          {isFree
            ? 'CB enregistrée, débit auto à J+30 · Annulable à tout moment'
            : 'Débit auto après l’essai · Résiliable à tout moment'}
        </p>
      </div>
    </article>
  )
}

function FeatureItem({
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

function ctaHrefFor(code: LogicielPlanCode, billing: BillingCycle): string {
  // Plan gratuit (V4: 'essai', alias V3: 'logiciel_free') → vers signup Solo Light.
  if (code === 'essai' || code === 'logiciel_free') return '/signup?plan=solo_light'
  return `/api/stripe/checkout?plan=${code}&cycle=${billing}`
}

function ctaLabelFor(code: LogicielPlanCode): string {
  if (code === 'essai' || code === 'logiciel_free') return "Démarrer l'essai"
  return 'Choisir'
}
