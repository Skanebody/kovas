'use client'

import { AppPageHeader } from '@/components/app-page-header'
import { BundlesGrid } from '@/components/pricing/BundlesGrid'
import { type BillingCycle, PricingToggle } from '@/components/pricing/PricingToggle'
import { useState } from 'react'

/**
 * Page /dashboard/upgrade/bundle
 *
 * Cross-sell Bundles (Annuaire + KOVAS packagés) pour un user `free` ou
 * pour proposer une bascule économique aux users single-track. Affiche les
 * 5 Bundles avec économie mensuelle en chartreuse.
 *
 * Layout authentifié `/dashboard/*` (DS v5 sage + chartreuse).
 */
export default function UpgradeBundlePage() {
  const [billing, setBilling] = useState<BillingCycle>('monthly')

  return (
    <div className="space-y-8 pb-8">
      <AppPageHeader
        eyebrow="Bundles Annuaire + KOVAS"
        title="Combinez et"
        accent="économisez"
        description="Souscrivez Annuaire + KOVAS en un seul abonnement et économisez jusqu'à 59 €/mois. Bundles transparents — l'économie mensuelle est affichée sur chaque card."
      />

      <div className="flex justify-center">
        <PricingToggle value={billing} onChange={setBilling} />
      </div>

      <section
        aria-labelledby="bundles-grid-heading"
        className="rounded-2xl bg-paper/60 p-4 sm:p-6"
      >
        <h2 id="bundles-grid-heading" className="sr-only">
          Bundles KOVAS
        </h2>
        <BundlesGrid billing={billing} />
      </section>

      <p className="text-xs text-foreground/55 max-w-2xl">
        Les Bundles regroupent un forfait KOVAS Annuaire (B2C lead-gen) et un forfait KOVAS (SaaS
        B2B) à un tarif avantageux. Résiliation à tout moment depuis ton compte, conformément au
        décret n°2023-417. Essai gratuit 30 jours avec carte bancaire enregistrée et débit
        automatique à l&apos;issue.
      </p>
    </div>
  )
}
