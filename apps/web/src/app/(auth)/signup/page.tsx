import { ADDON_MODULES, PRICING_PLANS, type PricingPlanCode } from '@/lib/pricing-plans'
import { ArrowLeft, Check } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { SignupForm } from './signup-form'

export const metadata: Metadata = {
  title: 'Créer mon compte KOVAS 360',
}

interface SignupSearchParams {
  plan?: string
  billing?: string
  addons?: string
}

/**
 * Étape 3/3 du parcours pricing : création du compte + saisie CB Stripe.
 *
 *   /pricing ─→ /pricing/checkout ─→ /signup (ici)
 *
 * Affiche en haut un récap du forfait + add-ons sélectionnés à l'étape 2,
 * suivi du formulaire d'inscription. Le SignupForm (existant) gère :
 *   - Saisie email + password + nom + téléphone
 *   - Création du compte Supabase Auth
 *   - Stripe Setup Intent (CB enregistrée mais pas prélevée)
 *   - Démarrage du trial 30j sur le forfait choisi
 *
 * Note : la mention "Sans CB" précédente a été retirée — le pivot 5 forfaits
 * impose CB obligatoire via Setup Intent (annulable en 3 clics avant J+30).
 */
export default async function SignupPage({
  searchParams,
}: {
  searchParams?: Promise<SignupSearchParams>
}) {
  const sp = searchParams ? await searchParams : {}

  const planCode = (sp.plan ?? null) as PricingPlanCode | null
  const billing = (sp.billing === 'annual' ? 'annual' : 'monthly') as 'monthly' | 'annual'
  const addonsCsv = sp.addons ?? ''

  const plan = planCode ? PRICING_PLANS.find((p) => p.code === planCode) : null
  const selectedAddons = addonsCsv
    ? ADDON_MODULES.filter((m) => addonsCsv.split(',').includes(m.code))
    : []

  // Refonte P9 : annualPrice = prix annuel HT (10× monthly, 2 mois offerts).
  // Pour afficher un équivalent mensuel en cycle annuel, on divise par 12.
  const planMonthlyPrice = plan
    ? billing === 'annual'
      ? Math.round(plan.annualPrice / 12)
      : plan.monthlyPrice
    : 0
  const addonsMonthlyTotal = selectedAddons.reduce((s, a) => s + a.monthlyPrice, 0)
  const totalAfterTrials = planMonthlyPrice + addonsMonthlyTotal

  return (
    <div className="w-full space-y-7 max-w-md mx-auto">
      {/* Retour si plan défini */}
      {plan && (
        <Link
          href={`/pricing/checkout?plan=${plan.code}&billing=${billing}`}
          className="inline-flex items-center gap-2 text-xs text-[#0F1419]/55 hover:text-[#0F1419] transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Modifier mon offre
        </Link>
      )}

      {/* Hero adapté selon présence du plan */}
      <div className="space-y-3 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#95B11A] font-semibold">
          {plan
            ? `Étape 3 sur 3 · Création du compte`
            : "30 jours d'essai · CB enregistrée · résiliation en 3 clics"}
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-[#0F1419] leading-[1.05]">
          Démarrer.
        </h1>
        <p className="text-sm md:text-base text-[#0F1419]/72">
          {plan
            ? `Premier prélèvement à J+30, annulable d'ici là en 3 clics.`
            : 'Tous les exports · Hébergement Paris · Premier prélèvement à J+30.'}
        </p>
      </div>

      {/* Récap forfait + add-ons si fourni en query params */}
      {plan && (
        <div className="bg-white rounded-2xl border border-[#0F1419]/[0.08] p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#0F1419]/55 font-semibold">
                Votre forfait
              </p>
              <p className="font-serif italic font-normal text-xl text-[#0F1419] leading-tight mt-0.5">
                {plan.name}
              </p>
            </div>
            <p className="font-mono text-sm font-semibold tabular-nums text-[#0F1419]">
              {planMonthlyPrice} € HT/mois
            </p>
          </div>

          {selectedAddons.length > 0 && (
            <div className="pt-3 border-t border-[#0F1419]/[0.08] space-y-1.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[#0F1419]/55 font-semibold">
                Modules en essai 14 jours
              </p>
              <ul className="space-y-1">
                {selectedAddons.map((a) => (
                  <li
                    key={a.code}
                    className="flex items-center justify-between gap-2 text-[12px] text-[#0F1419]"
                  >
                    <span className="flex items-center gap-1.5">
                      <Check className="size-3 text-[#95B11A]" />
                      {a.name}
                    </span>
                    <span className="font-mono text-xs text-[#0F1419]/55 tabular-nums">
                      +{a.monthlyPrice} €
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-3 border-t border-[#0F1419]/[0.08] flex items-baseline justify-between gap-3">
            <span className="text-xs text-[#0F1419]/72">Total prévisionnel après essais</span>
            <span className="font-serif italic font-normal text-lg text-[#0F1419] tabular-nums">
              {totalAfterTrials} € HT/mois
            </span>
          </div>
        </div>
      )}

      <SignupForm />

      <p className="text-center text-[13px] text-[#0F1419]/72 pt-2 border-t border-[#0F1419]/[0.08]">
        Déjà un compte ?{' '}
        <Link
          href="/login"
          className="text-[#0F1419] font-semibold underline-offset-4 hover:underline"
        >
          Se connecter
        </Link>
      </p>
    </div>
  )
}
