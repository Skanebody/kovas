'use client'

import { AppPageHeader } from '@/components/app-page-header'
import { LogicielTrackGrid } from '@/components/pricing/LogicielTrackGrid'
import { type BillingCycle, PricingToggle } from '@/components/pricing/PricingToggle'
import { useState } from 'react'

/**
 * Page /dashboard/upgrade/logiciel
 *
 * Cross-sell KOVAS 360 (SaaS B2B) pour un user `annuaire-only` ou `free`.
 * Affiche les 5 tiers Logiciel (free / starter / active / cabinet / enterprise)
 * avec toggle mensuel/annuel et CTAs Stripe checkout.
 *
 * Layout authentifié `/dashboard/*` (DS v5 sage + chartreuse).
 */
export default function UpgradeLogicielPage() {
  const [billing, setBilling] = useState<BillingCycle>('monthly')

  return (
    <div className="space-y-8 pb-8">
      <AppPageHeader
        eyebrow="KOVAS 360"
        title="Gagnez"
        accent="1h30 par mission"
        description="Le logiciel terrain qui élimine la friction : saisie vocale, photos géolocalisées, exports multi-format universels et bouton Partager 3 modes vers Liciel. Migration sans rupture."
      />

      <div className="flex justify-center">
        <PricingToggle value={billing} onChange={setBilling} />
      </div>

      <section
        aria-labelledby="logiciel-grid-heading"
        className="rounded-2xl bg-paper/60 p-4 sm:p-6"
      >
        <h2 id="logiciel-grid-heading" className="sr-only">
          Forfaits KOVAS 360
        </h2>
        <LogicielTrackGrid billing={billing} />
      </section>

      <p className="text-xs text-foreground/55 max-w-2xl">
        KOVAS 360 est le logiciel SaaS B2B pour diagnostiqueurs immobiliers indépendants. Tarif
        fixe mensuel, missions illimitées sous fair-use, sans surplus à l&apos;usage. Essai
        gratuit 14 jours sans carte bancaire — résiliation conforme au décret n°2023-417.
      </p>
    </div>
  )
}
