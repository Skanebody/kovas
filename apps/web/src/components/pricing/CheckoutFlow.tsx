'use client'

import {
  ADDON_MODULES,
  PRICING_PLANS,
  type AddonModule,
  type PricingPlan,
  type PricingPlanCode,
} from '@/lib/pricing-plans'
import { cn } from '@/lib/utils'
import { ArrowRight, Check, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

interface CheckoutFlowProps {
  planCode: PricingPlanCode
  billing: 'monthly' | 'annual'
}

/**
 * Flow checkout étape 2 — sélection add-ons + récap sticky.
 *
 * Layout 2 colonnes responsive :
 *   - Gauche (2/3) : grille des add-ons NON inclus dans le forfait, avec
 *     toggle "Activer l'essai 14j gratuit" par module
 *   - Droite (1/3) : récap sticky avec :
 *       - Forfait choisi (nom + prix + features clés)
 *       - Add-ons sélectionnés (avec prix mensuel projeté)
 *       - Total mensuel après essais (J+14 pour modules / J+30 pour forfait)
 *       - Bouton "Continuer vers la création du compte"
 *
 * Les add-ons déjà INCLUS dans le forfait choisi sont affichés en mode
 * "Inclus" (chartreuse, non interactif).
 */
export function CheckoutFlow({ planCode, billing }: CheckoutFlowProps) {
  const plan = PRICING_PLANS.find((p) => p.code === planCode) as PricingPlan
  const monthlyPrice = billing === 'annual' ? plan.annualPrice : plan.monthlyPrice

  // État local des add-ons cochés
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set())

  const toggleAddon = (code: string) => {
    setSelectedAddons((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  // Séparation des add-ons : inclus vs disponibles
  const { included, available } = useMemo(() => {
    const inc: AddonModule[] = []
    const av: AddonModule[] = []
    for (const addon of ADDON_MODULES) {
      if (addon.includedInPlans.includes(planCode)) inc.push(addon)
      else av.push(addon)
    }
    return { included: inc, available: av }
  }, [planCode])

  // Calcul du total post-essais
  const selectedAddonsPrice = useMemo(() => {
    return Array.from(selectedAddons).reduce((sum, code) => {
      const addon = available.find((a) => a.code === code)
      return sum + (addon?.monthlyPrice ?? 0)
    }, 0)
  }, [selectedAddons, available])

  const totalAfterTrials = monthlyPrice + selectedAddonsPrice

  // Construction du href vers /signup avec params
  const signupHref = useMemo(() => {
    const params = new URLSearchParams({
      plan: planCode,
      billing,
    })
    if (selectedAddons.size > 0) {
      params.set('addons', Array.from(selectedAddons).join(','))
    }
    return `/signup?${params.toString()}`
  }, [planCode, billing, selectedAddons])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
      {/* COLONNE GAUCHE : add-ons disponibles + inclus */}
      <div className="space-y-10">
        {available.length > 0 && (
          <section>
            <header className="mb-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-semibold mb-2">
                Modules optionnels
              </p>
              <h2 className="font-sans font-semibold text-xl tracking-tight">
                Ajoutez des modules en essai{' '}
                <span className="font-serif italic font-normal text-[#0F1419]/72">
                  14 jours gratuit.
                </span>
              </h2>
              <p className="text-[13px] text-[#0F1419]/72 mt-2 max-w-xl">
                Aucune CB requise pour les modules — désactivation 1 clic avant J+14, sinon
                facturation auto au tarif unitaire indiqué.
              </p>
            </header>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {available.map((addon) => {
                const isSelected = selectedAddons.has(addon.code)
                return (
                  <li key={addon.code}>
                    <button
                      type="button"
                      onClick={() => toggleAddon(addon.code)}
                      className={cn(
                        'w-full text-left flex flex-col p-4 rounded-[16px] border-2 transition-all duration-150',
                        isSelected
                          ? 'border-chartreuse bg-chartreuse/10'
                          : 'border-[#0F1419]/[0.08] bg-white hover:border-[#0F1419]/35',
                      )}
                      aria-pressed={isSelected}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-[14px] font-semibold leading-tight">
                          {addon.name}
                        </h3>
                        <span
                          className={cn(
                            'shrink-0 size-5 rounded-md border-2 flex items-center justify-center transition-colors',
                            isSelected
                              ? 'bg-chartreuse border-chartreuse'
                              : 'border-[#0F1419]/25',
                          )}
                          aria-hidden
                        >
                          {isSelected && <Check className="size-3 text-[#0F1419]" strokeWidth={3} />}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#0F1419]/72 leading-snug flex-1 mb-3">
                        {addon.description}
                      </p>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#0F1419]/55">
                          14 j essai gratuit
                        </span>
                        <span className="font-mono text-[12px] font-semibold tabular-nums">
                          {addon.monthlyPrice} € HT/mois
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {included.length > 0 && (
          <section>
            <header className="mb-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-semibold mb-2">
                Inclus dans {plan.name}
              </p>
              <h2 className="font-sans font-semibold text-xl tracking-tight">
                <span className="font-serif italic font-normal text-[#0F1419]/72">
                  {included.length}
                </span>{' '}
                modules déjà activés dans votre forfait.
              </h2>
            </header>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {included.map((addon) => (
                <li
                  key={addon.code}
                  className="flex items-start gap-2.5 p-4 rounded-[16px] bg-chartreuse/15 border border-chartreuse/30"
                >
                  <Check
                    className="size-4 text-[#0F1419] shrink-0 mt-0.5"
                    strokeWidth={2.5}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#0F1419] leading-tight">
                      {addon.name}
                    </p>
                    <p className="text-[11px] text-[#0F1419]/55 mt-0.5 truncate">
                      {addon.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* COLONNE DROITE : récap sticky */}
      <aside className="lg:sticky lg:top-24 h-fit">
        <div className="bg-[#0F1419] text-white rounded-[24px] p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/60 font-semibold mb-3">
            Récap de votre offre
          </p>

          {/* Forfait choisi */}
          <div className="mb-5">
            <p className="text-xs text-white/60 uppercase tracking-wider mb-1">Forfait</p>
            <p className="font-serif italic font-normal text-2xl text-white leading-tight">
              {plan.name}
            </p>
            <p className="font-mono text-[11px] text-white/60 mt-1">
              Missions illimitées (jusqu'à {plan.caps.missions}/mois) · {plan.caps.storageGb} Go
            </p>
            <p className="font-mono text-sm text-white tabular-nums mt-2">
              {monthlyPrice} € HT / mois
              {billing === 'annual' && (
                <span className="text-white/60 text-xs"> · facturé annuellement</span>
              )}
            </p>
          </div>

          {/* Add-ons sélectionnés */}
          {selectedAddons.size > 0 && (
            <div className="mb-5 pt-4 border-t border-white/15">
              <p className="text-xs text-white/60 uppercase tracking-wider mb-2">
                Modules en essai
              </p>
              <ul className="space-y-1.5">
                {Array.from(selectedAddons).map((code) => {
                  const addon = available.find((a) => a.code === code)
                  if (!addon) return null
                  return (
                    <li
                      key={code}
                      className="flex items-baseline justify-between gap-2 text-[13px]"
                    >
                      <span className="text-white/90 truncate flex-1 min-w-0">
                        {addon.name}
                      </span>
                      <span className="font-mono text-xs text-white/60 tabular-nums shrink-0">
                        + {addon.monthlyPrice} €/mo
                      </span>
                    </li>
                  )
                })}
              </ul>
              <p className="font-mono text-[10px] text-chartreuse mt-2 leading-snug">
                Gratuits 14 jours · décision à J+14
              </p>
            </div>
          )}

          {/* Total prévisionnel */}
          <div className="pt-4 border-t border-white/15">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-xs text-white/60 uppercase tracking-wider">
                Total prévisionnel
              </span>
              <span className="font-mono text-[10px] text-white/50">après essais</span>
            </div>
            <p className="font-serif italic font-normal text-4xl text-chartreuse leading-none tracking-tight mt-1">
              {totalAfterTrials} €
              <span className="font-sans not-italic text-sm text-white/60 ml-1">HT/mois</span>
            </p>
            <p className="text-xs text-white/60 mt-2 leading-snug">
              {selectedAddons.size > 0
                ? `${monthlyPrice} € (forfait) + ${selectedAddonsPrice} € (modules) après leurs essais respectifs. Rien n'est prélevé immédiatement.`
                : "Aucun prélèvement immédiat. Premier débit à J+30, annulable d'ici là en 3 clics."}
            </p>
          </div>

          {/* CTA */}
          <Link
            href={signupHref}
            className="mt-6 flex items-center justify-center gap-2 w-full bg-chartreuse text-[#0F1419] py-4 rounded-[16px] text-base font-semibold hover:bg-chartreuse-deep hover:-translate-y-px transition-all duration-150"
          >
            Créer mon compte
            <ArrowRight className="size-4" />
          </Link>
          <p className="text-center text-[11px] text-white/50 mt-3 font-mono leading-snug">
            Étape 3/3 · Prochaine étape : compte + CB
          </p>
        </div>

        {/* Note rassurance */}
        <div className="mt-4 flex items-start gap-2.5 text-[12px] text-[#0F1419]/72 leading-snug">
          <Sparkles className="size-3.5 text-[#0F1419]/55 shrink-0 mt-0.5" aria-hidden />
          <p>
            Vous pourrez activer ou retirer ces modules à tout moment depuis votre compte, sans
            engagement.
          </p>
        </div>
      </aside>
    </div>
  )
}
