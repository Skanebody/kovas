import { CheckoutFlow } from '@/components/pricing/CheckoutFlow'
import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { PRICING_PLANS, type PricingPlanCode } from '@/lib/pricing-plans'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export const metadata: Metadata = { title: 'Finaliser votre commande KOVAS' }

interface CheckoutSearchParams {
  plan?: string
  billing?: string
}

/**
 * Étape 2 du parcours client (post-clic "Démarrer" sur /pricing).
 *
 *   /pricing ─→ /pricing/checkout?plan=pro&billing=monthly ─→ /signup
 *
 * Cette page sert à :
 *   1. Récapituler le forfait choisi (récap sticky right)
 *   2. Proposer les add-ons en mode trial 14j gratuit (sans engagement)
 *   3. Afficher le total prévisionnel
 *   4. Mener vers /signup avec les paramètres résolus
 *
 * Pas de saisie CB ici — c'est juste la confirmation du choix avant signup.
 * Le user peut décider d'ajouter des modules sans risque (essai gratuit 14j).
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams?: Promise<CheckoutSearchParams>
}) {
  const sp = searchParams ? await searchParams : {}

  const planCode = (sp.plan ?? 'pro') as PricingPlanCode
  const billing = (sp.billing === 'annual' ? 'annual' : 'monthly') as 'monthly' | 'annual'

  // Vérification du plan_code — sinon redirect 404
  const plan = PRICING_PLANS.find((p) => p.code === planCode)
  if (!plan) notFound()

  return (
    <div className="min-h-dvh flex flex-col bg-[#F5F7F4] text-[#0F1419] font-sans">
      <PublicHeader />

      <main className="flex-1 px-5 sm:px-12 py-10 sm:py-16">
        <div className="max-w-[1240px] mx-auto">
          {/* Retour */}
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 text-sm text-[#0F1419]/72 hover:text-[#0F1419] mb-8 transition-colors"
          >
            <ArrowLeft className="size-4" /> Changer de forfait
          </Link>

          {/* Header */}
          <div className="mb-10">
            <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-[#0F1419]/55 font-semibold mb-3">
              Étape 2 sur 3 — Récap & options
            </p>
            <h1 className="font-sans font-semibold text-3xl sm:text-4xl md:text-5xl leading-tight tracking-tight mb-4">
              Vous avez choisi{' '}
              <span className="font-serif italic font-normal text-[#0F1419]/72">{plan.name}</span>.
            </h1>
            <p className="text-base sm:text-lg text-[#0F1419]/72 leading-relaxed max-w-2xl">
              Personnalisez votre offre avec des modules optionnels — chacun en essai gratuit 14
              jours, désactivables d'un clic. La création du compte vient juste après.
            </p>
          </div>

          {/* Flow interactif : sélection add-ons + récap sticky */}
          <CheckoutFlow planCode={planCode} billing={billing} />

          {/* Progress steps */}
          <ProgressSteps current={2} />
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}

function ProgressSteps({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { num: 1, label: 'Forfait' },
    { num: 2, label: 'Options' },
    { num: 3, label: 'Création de compte' },
  ]
  return (
    <div className="mt-16 pt-8 border-t border-[#0F1419]/[0.08]">
      <ol className="flex items-center justify-center gap-3 sm:gap-6 flex-wrap">
        {steps.map((step) => {
          const isActive = step.num === current
          const isDone = step.num < current
          return (
            <li key={step.num} className="flex items-center gap-3 sm:gap-6">
              <span
                className={`inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.1em] ${
                  isActive
                    ? 'text-[#0F1419] font-bold'
                    : isDone
                      ? 'text-[#0F1419]/72'
                      : 'text-[#0F1419]/35'
                }`}
              >
                <span
                  className={`size-6 rounded-full inline-flex items-center justify-center font-mono text-xs ${
                    isActive
                      ? 'bg-chartreuse text-[#0F1419]'
                      : isDone
                        ? 'bg-[#0F1419] text-white'
                        : 'bg-[#0F1419]/[0.08] text-[#0F1419]/55'
                  }`}
                >
                  {step.num}
                </span>
                {step.label}
              </span>
              {step.num < 3 && (
                <span aria-hidden className="text-[#0F1419]/15">
                  →
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
