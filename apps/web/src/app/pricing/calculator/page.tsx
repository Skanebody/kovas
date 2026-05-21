'use client'

import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { AddonPicker } from '@/components/pricing/AddonPicker'
import {
  ADDON_MODULES,
  PRICING_PLANS,
  getAddonByCode,
  getPlanByCode,
  type AddonCode,
  type PricingPlan,
  type PricingPlanCode,
} from '@/lib/pricing-plans'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { useMemo, useState } from 'react'

/**
 * Page `/pricing/calculator` — constructeur d'offre interactif.
 *
 * Flow :
 *   1. L'utilisateur choisit son forfait de base (5 mini-cards radio)
 *   2. L'utilisateur sélectionne ses add-ons (modules non inclus dans le plan)
 *   3. Le récap sticky right affiche : plan + modules + total HT / mois
 *   4. CTA "Commencer mon essai 30 jours" → /signup avec params
 *
 * Tous les modules à prix mensuel fixe contribuent au total. Les modules à prix
 * unitaire (signatures, SMS) sont listés pour information mais n'ajoutent rien
 * au total mensuel (consommation à l'usage facturée séparément).
 */
export default function PricingCalculatorPage() {
  const defaultPlan =
    PRICING_PLANS.find((p) => p.featured)?.code ?? PRICING_PLANS[0]?.code ?? 'pro'

  const [planCode, setPlanCode] = useState<PricingPlanCode>(defaultPlan)
  const [selectedAddons] = useState<AddonCode[]>([])

  const plan: PricingPlan | undefined = useMemo(() => getPlanByCode(planCode), [planCode])

  const monthlyTotal = useMemo(() => {
    const planPrice = plan?.monthlyPrice ?? 0
    const addonsPrice = selectedAddons.reduce((sum, code) => {
      const addon = getAddonByCode(code)
      if (addon === undefined) return sum
      // Modules unitaires (signature / SMS / rapport) : pas de coût mensuel fixe
      // (overage facturé séparément à l'usage).
      if (addon.overageUnit !== null && addon.monthlyPrice === 0) return sum
      return sum + addon.monthlyPrice
    }, 0)
    return planPrice + addonsPrice
  }, [plan, selectedAddons])

  // AddonPicker gère son propre state ; selectedAddons reste en state local
  // pour le récap sticky et le signupHref.

  // Calculator = exploration libre sans toggle billing ; default monthly pour
  // signup (l'utilisateur pourra basculer en annuel depuis Stripe Customer Portal).
  const signupHref = `/signup?plan=${planCode}&billing=monthly${
    selectedAddons.length > 0 ? `&addons=${selectedAddons.join(',')}` : ''
  }`

  return (
    <div className="min-h-dvh flex flex-col bg-[#F5F7F4] text-[#0F1419] font-sans">
      <LandingHeader current="pricing" />

      <main className="flex-1">
        {/* Hero compact */}
        <section className="px-5 sm:px-12 max-w-[1240px] mx-auto text-center pt-16 sm:pt-24 pb-10">
          <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-medium mb-6">
            Constructeur d'offre
          </p>
          <h1 className="font-sans font-semibold text-[40px] sm:text-[56px] md:text-[72px] leading-[1.02] tracking-[-0.035em] mb-6">
            Composez votre KOVAS 360.
            <span className="block text-[#0F1419]/35">À l'euro près.</span>
          </h1>
          <p className="text-[16px] sm:text-[18px] text-[#0F1419]/72 max-w-[680px] mx-auto leading-relaxed">
            Choisissez un forfait, ajoutez les modules dont vous avez vraiment besoin. Total HT
            mensuel mis à jour en direct, aucune surprise.
          </p>
        </section>

        <section className="px-5 sm:px-12 max-w-[1240px] mx-auto pb-20 sm:pb-32 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10 lg:gap-12 items-start">
          {/* Colonne principale */}
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
                Chaque module activé bénéficie d'un essai 14 jours offert. Les modules déjà
                inclus dans votre forfait apparaissent en chartreuse — pas besoin de les
                cocher.
              </p>
              <AddonPicker />
              {/* state local conservé pour le récap sticky (toggle géré via packs) */}
              {selectedAddons.length === 0 ? null : null}
            </div>
          </div>

          {/* Récap sticky */}
          <RecapPanel
            plan={plan}
            selectedAddons={selectedAddons}
            monthlyTotal={monthlyTotal}
            signupHref={signupHref}
          />
        </section>
      </main>

      <LandingFooter />
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
  selected: PricingPlanCode
  onSelect: (code: PricingPlanCode) => void
}) {
  return (
    <div>
      <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold mb-2">
        Étape 1
      </p>
      <h2 className="text-[24px] sm:text-[32px] font-semibold tracking-[-0.02em] mb-6">
        Choisissez votre forfait.
      </h2>
      <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {PRICING_PLANS.map((plan) => {
          const isSelected = plan.code === selected
          return (
            <li key={plan.code}>
              <button
                type="button"
                onClick={() => onSelect(plan.code)}
                aria-pressed={isSelected}
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
                  {plan.featured ? 'Recommandé' : ' '}
                </p>
                <p className="text-[14px] font-semibold leading-tight mb-2">{plan.name}</p>
                <p className="font-serif italic text-[28px] leading-none tracking-[-0.02em]">
                  {plan.monthlyPrice}
                  <span
                    className={cn(
                      'font-sans not-italic font-medium text-[11px] ml-1',
                      isSelected ? 'text-white/60' : 'text-[#0F1419]/55',
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
  plan: PricingPlan | undefined
  selectedAddons: AddonCode[]
  monthlyTotal: number
  signupHref: string
}) {
  if (plan === undefined) {
    return null
  }

  // Add-on récurrent : monthlyPrice > 0 et pas d'overage à l'unité
  const recurringAddons = selectedAddons
    .map((c) => getAddonByCode(c))
    .filter(
      (a): a is NonNullable<typeof a> =>
        a !== undefined && !(a.overageUnit !== null && a.monthlyPrice === 0),
    )

  // Add-on à l'unité : pas de prix mensuel fixe (consommation pure)
  const unitAddons = selectedAddons
    .map((c) => getAddonByCode(c))
    .filter(
      (a): a is NonNullable<typeof a> =>
        a !== undefined && a.overageUnit !== null && a.monthlyPrice === 0,
    )

  return (
    <aside className="bg-white border border-[#0F1419]/[0.08] rounded-[24px] p-6 lg:sticky lg:top-24">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#0F1419]/55 font-semibold mb-4">
        Votre offre
      </p>

      <div className="flex items-baseline justify-between gap-3 pb-4 border-b border-[#0F1419]/[0.08]">
        <div>
          <p className="text-[14px] font-semibold text-[#0F1419]">{plan.name}</p>
          <p className="text-[12px] text-[#0F1419]/55">Forfait de base</p>
        </div>
        <p className="font-semibold text-[16px] tabular-nums">{plan.monthlyPrice} €</p>
      </div>

      {recurringAddons.length > 0 && (
        <ul className="py-4 space-y-3 border-b border-[#0F1419]/[0.08]">
          {recurringAddons.map((a) => (
            <li key={a.code} className="flex items-baseline justify-between gap-3 text-[14px]">
              <span className="text-[#0F1419]/80 flex-1">{a.name}</span>
              <span className="font-semibold tabular-nums">{a.monthlyPrice} €</span>
            </li>
          ))}
        </ul>
      )}

      {unitAddons.length > 0 && (
        <div className="pt-4 pb-4 border-b border-[#0F1419]/[0.08]">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#0F1419]/55 font-semibold mb-2">
            À l'usage (hors forfait)
          </p>
          <ul className="space-y-2">
            {unitAddons.map((a) => (
              <li key={a.code} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="text-[#0F1419]/72 flex-1">{a.name}</span>
                <span className="font-medium text-[#0F1419]/72 tabular-nums">
                  {a.overagePrice !== null
                    ? `${(a.overagePrice / 100).toFixed(2).replace('.', ',')} € / ${a.overageUnit}`
                    : `${(a.monthlyPrice / 100).toFixed(2).replace('.', ',')} €`}
                </span>
              </li>
            ))}
          </ul>
        </div>
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
        className="mt-6 block w-full text-center py-4 px-5 rounded-[16px] bg-chartreuse text-[#0F1419] font-semibold text-[15px] hover:bg-chartreuse-deep transition-colors"
      >
        Commencer mon essai 30 jours
      </Link>
      <p className="text-center mt-3 text-[11px] text-[#0F1419]/55 leading-snug">
        CB enregistrée pour continuité sans interruption. Annulable en 3 clics avant J+30.
      </p>

      {ADDON_MODULES.length > 0 && (
        <p className="mt-5 pt-5 border-t border-[#0F1419]/[0.08] text-[12px] text-[#0F1419]/55 leading-snug">
          Tous les modules optionnels bénéficient d'un essai 14 jours gratuit. Résiliation
          module-par-module possible à tout moment.
        </p>
      )}
    </aside>
  )
}
