'use client'

import { AddonPicker } from '@/components/pricing/AddonPicker'
import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
// Type B2 dependency — pricing-plans.ts refonte by parallel agent
import {
  ADDON_MODULES,
  type AddonCode,
  LOGICIEL_PLANS,
  type LogicielPlan,
  type LogicielPlanCode,
  getAddon,
  getLogicielPlan,
} from '@/lib/pricing-plans'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useMemo, useState } from 'react'

/**
 * Page `/pricing/calculator` — constructeur d'offre interactif V3.
 *
 * Refonte 2026-05-21 : focus track Logiciel KOVAS (5 tiers) + 4 add-ons.
 * Pour combinaisons Annuaire + Logiciel, l'utilisateur passe par les Bundles
 * sur `/pricing`. Le calculator reste un explorateur libre pour le track
 * logiciel.
 *
 * Flow :
 *   1. Choix du forfait KOVAS parmi 5 (mini-cards radio)
 *   2. Sélection des 4 add-ons (toggle)
 *   3. Récap sticky : plan + modules + total HT / mois
 *   4. CTA "Démarrer l'essai 14 jours" → /signup avec params
 */
export default function PricingCalculatorPage() {
  const defaultPlan: LogicielPlanCode =
    (LOGICIEL_PLANS.find((p) => p.featured === true)?.code as LogicielPlanCode) ??
    'logiciel_starter'

  const [planCode, setPlanCode] = useState<LogicielPlanCode>(defaultPlan)
  const [selectedAddons] = useState<AddonCode[]>([])

  const plan: LogicielPlan | undefined = useMemo(() => getLogicielPlan(planCode), [planCode])

  const monthlyTotal = useMemo(() => {
    const planPriceCents = plan?.monthlyPrice ?? 0
    const addonsPriceCents = selectedAddons.reduce((sum, code) => {
      const addon = getAddon(code)
      if (addon === undefined) return sum
      return sum + addon.monthlyPrice
    }, 0)
    return Math.round((planPriceCents + addonsPriceCents) / 100)
  }, [plan, selectedAddons])

  const signupHref = `/signup?plan=${planCode}&billing=monthly${
    selectedAddons.length > 0 ? `&addons=${selectedAddons.join(',')}` : ''
  }`

  return (
    <div className="min-h-dvh flex flex-col bg-[#F5F7F4] text-[#0F1419] font-sans">
      <PublicHeader />

      <main className="flex-1">
        <section className="px-5 sm:px-12 max-w-[1240px] mx-auto text-center pt-16 sm:pt-24 pb-10">
          <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-medium mb-6">
            Constructeur d'offre
          </p>
          <h1 className="font-sans font-semibold text-[40px] sm:text-[56px] md:text-[72px] leading-[1.02] tracking-[-0.035em] mb-6">
            Composez votre KOVAS.
            <span className="block text-[#0F1419]/35">À l'euro près.</span>
          </h1>
          <p className="text-[16px] sm:text-[18px] text-[#0F1419]/72 max-w-[680px] mx-auto leading-relaxed">
            Choisissez un forfait logiciel, ajoutez les modules dont vous avez vraiment besoin. Pour
            combiner avec l'Annuaire, voyez les{' '}
            <Link
              href="/pricing#bundles"
              className="border-b border-[#0F1419]/35 hover:border-[#0F1419]"
            >
              Bundles
            </Link>
            .
          </p>
        </section>

        <section className="px-5 sm:px-12 max-w-[1240px] mx-auto pb-20 sm:pb-32 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 lg:gap-12 items-start">
          <div className="space-y-12">
            <PlanPicker selected={planCode} onSelect={setPlanCode} />

            <div>
              <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold mb-2">
                Étape 2
              </p>
              <h2 className="text-[24px] sm:text-[32px] font-semibold tracking-[-0.02em] mb-2">
                Ajoutez vos modules.
              </h2>
              <p className="text-[14px] text-[#0F1419]/72 mb-6 leading-relaxed">
                Quatre modules indépendants du forfait : signatures eIDAS, Pennylane, SMS rappel,
                Communauté Pro. Activables à tout moment.
              </p>
              <AddonPicker />
            </div>
          </div>

          <RecapPanel
            plan={plan}
            selectedAddons={selectedAddons}
            monthlyTotal={monthlyTotal}
            signupHref={signupHref}
          />
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}

/* ============================================================
   STEP 1 — Choix forfait (mini-cards)
   ============================================================ */
function PlanPicker({
  selected,
  onSelect,
}: {
  selected: LogicielPlanCode
  onSelect: (code: LogicielPlanCode) => void
}) {
  return (
    <div>
      <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold mb-2">
        Étape 1
      </p>
      <h2 className="text-[24px] sm:text-[32px] font-semibold tracking-[-0.02em] mb-6">
        Choisissez votre forfait KOVAS.
      </h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {LOGICIEL_PLANS.map((plan: LogicielPlan) => {
          const isSelected = plan.code === selected
          const monthlyEuros = Math.round(plan.monthlyPrice / 100)
          return (
            <li key={plan.code}>
              <button
                type="button"
                onClick={() => onSelect(plan.code as LogicielPlanCode)}
                aria-pressed={isSelected}
                aria-label={`Choisir le forfait ${plan.name}`}
                className={cn(
                  'w-full h-full text-left rounded-[20px] p-4 border-2 transition-colors duration-150',
                  isSelected
                    ? 'border-[#0F1419] bg-[#0F1419] text-white'
                    : 'border-[#0F1419]/[0.08] bg-white text-[#0F1419] hover:border-[#0F1419]/45',
                )}
              >
                <p
                  className={cn(
                    'font-mono text-[10px] uppercase tracking-[0.14em] font-semibold mb-1',
                    isSelected ? 'text-chartreuse' : 'text-[#0F1419]/55',
                  )}
                >
                  {plan.featured === true ? 'Populaire' : ' '}
                </p>
                <p className="text-[14px] font-semibold leading-tight mb-2">{plan.name}</p>
                <p className="font-serif italic text-[28px] leading-none tracking-[-0.02em]">
                  {monthlyEuros}
                  <span
                    className={cn(
                      'font-sans not-italic font-medium text-[11px] ml-1',
                      isSelected ? 'text-white/72' : 'text-[#0F1419]/55',
                    )}
                  >
                    €
                  </span>
                </p>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ============================================================
   RECAP — sticky right
   ============================================================ */
function RecapPanel({
  plan,
  selectedAddons,
  monthlyTotal,
  signupHref,
}: {
  plan: LogicielPlan | undefined
  selectedAddons: AddonCode[]
  monthlyTotal: number
  signupHref: string
}) {
  if (plan === undefined) {
    return null
  }

  const recurringAddons = selectedAddons
    .map((c) => getAddon(c))
    .filter((a): a is NonNullable<typeof a> => a !== undefined)

  return (
    <aside className="bg-white border border-[#0F1419]/[0.08] rounded-[24px] p-6 lg:sticky lg:top-24">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold mb-4">
        Votre offre
      </p>

      <div className="flex items-baseline justify-between gap-3 pb-4 border-b border-[#0F1419]/[0.08]">
        <div>
          <p className="text-[14px] font-semibold text-[#0F1419]">{plan.name}</p>
          <p className="text-[12px] text-[#0F1419]/55">Forfait KOVAS</p>
        </div>
        <p className="font-semibold text-[16px] tabular-nums">
          {Math.round(plan.monthlyPrice / 100)} €
        </p>
      </div>

      {recurringAddons.length > 0 && (
        <ul className="py-4 space-y-3 border-b border-[#0F1419]/[0.08]">
          {recurringAddons.map((a) => (
            <li key={a.code} className="flex items-baseline justify-between gap-3 text-[14px]">
              <span className="text-[#0F1419]/80 flex-1">{a.name}</span>
              <span className="font-semibold tabular-nums">
                {Math.round(a.monthlyPrice / 100)} €
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-5 flex items-baseline justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#0F1419]/72 font-semibold">
          Total HT / mois
        </p>
        <p className="font-serif italic text-[48px] leading-none tracking-[-0.02em] tabular-nums">
          {monthlyTotal} €
        </p>
      </div>

      <Link
        href={signupHref}
        aria-label="Démarrer l'essai 14 jours avec la configuration choisie"
        className="mt-6 block w-full text-center py-4 px-5 rounded-[16px] bg-chartreuse text-[#0F1419] font-semibold text-[15px] hover:bg-chartreuse-deep transition-colors"
      >
        Démarrer l'essai 14 jours
      </Link>
      <p className="text-center mt-3 text-[11px] text-[#0F1419]/55 leading-snug">
        CB enregistrée à la souscription, débit automatique à J+30. Annulable à tout moment.
      </p>

      {ADDON_MODULES.length > 0 && (
        <p className="mt-5 pt-5 border-t border-[#0F1419]/[0.08] text-[12px] text-[#0F1419]/55 leading-snug">
          Les modules sont activables / désactivables module-par-module depuis Réglages → Modules.
          Surcharges à l'usage (signatures, SMS) facturées à la consommation.
        </p>
      )}
    </aside>
  )
}
