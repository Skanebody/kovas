'use client'

import { AppPageHeader } from '@/components/app-page-header'
import { LogicielTrackGrid } from '@/components/pricing/LogicielTrackGrid'
import { type BillingCycle, PricingToggle } from '@/components/pricing/PricingToggle'
import { useState } from 'react'

/**
 * Page /dashboard/upgrade/logiciel
 *
 * Cross-sell KOVAS (SaaS B2B) pour un user `annuaire-only` ou en essai 30j.
 * Affiche les 5 tiers Logiciel canoniques V5 (essai 30j / solo 29€ /
 * pro 79€ / cabinet 199€ / cabinet_plus 499€ / enterprise sur devis) avec
 * toggle mensuel/annuel et CTAs Stripe checkout.
 *
 * Layout authentifié `/dashboard/*` (DS v5 sage + chartreuse).
 */
export default function UpgradeLogicielPage() {
  const [billing, setBilling] = useState<BillingCycle>('monthly')

  return (
    <div className="space-y-8 pb-8">
      <AppPageHeader
        eyebrow="KOVAS"
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
          Forfaits KOVAS
        </h2>
        <LogicielTrackGrid billing={billing} />
      </section>

      <p className="text-xs text-foreground/55 max-w-2xl">
        KOVAS est le logiciel SaaS B2B pour diagnostiqueurs immobiliers indépendants. Tarif fixe
        mensuel, missions illimitées sous fair-use, sans surplus à l&apos;usage. Essai gratuit 30
        jours avec carte bancaire enregistrée et débit automatique à l&apos;issue — résiliation
        conforme au décret n°2023-417.
      </p>
    </div>
  )
}
