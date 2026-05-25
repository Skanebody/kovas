'use client'

import { AppPageHeader } from '@/components/app-page-header'
import { AnnuaireTrackGrid } from '@/components/pricing/AnnuaireTrackGrid'
import { type BillingCycle, PricingToggle } from '@/components/pricing/PricingToggle'
import { useState } from 'react'

/**
 * Page /dashboard/upgrade/annuaire
 *
 * Cross-sell KOVAS Annuaire pour un user `logiciel-only` (ou free). Affiche
 * les 4 tiers Annuaire (free / pro / visibility / sponsored) avec toggle
 * mensuel/annuel et CTAs Stripe checkout.
 *
 * Layout authentifié `/dashboard/*` (DS v5 sage + chartreuse + dark sidebar
 * via le parent layout).
 */
export default function UpgradeAnnuairePage() {
  const [billing, setBilling] = useState<BillingCycle>('monthly')

  return (
    <div className="space-y-8 pb-8">
      <AppPageHeader
        eyebrow="KOVAS Annuaire"
        title="Recevez vos premiers"
        accent="leads particuliers"
        description="KOVAS Annuaire vous met en relation avec des vendeurs, bailleurs et acheteurs qui cherchent un diagnostiqueur près d'eux. Tarification transparente, aucun engagement."
      />

      <div className="flex justify-center">
        <PricingToggle value={billing} onChange={setBilling} />
      </div>

      <section
        aria-labelledby="annuaire-grid-heading"
        className="rounded-2xl bg-paper/60 p-4 sm:p-6"
      >
        <h2 id="annuaire-grid-heading" className="sr-only">
          Forfaits KOVAS Annuaire
        </h2>
        <AnnuaireTrackGrid billing={billing} />
      </section>

      <p className="text-xs text-foreground/55 max-w-2xl">
        KOVAS Annuaire est un produit complémentaire de KOVAS — vous pouvez souscrire à
        l&apos;Annuaire seul ou en bundle économique avec votre logiciel actuel pour un prix
        avantageux. Pas d&apos;engagement de durée, résiliation conforme au décret n°2023-417.
      </p>
    </div>
  )
}
