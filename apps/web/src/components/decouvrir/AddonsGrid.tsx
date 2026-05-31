'use client'

import { ADDON_OFFERS } from '@/lib/decouvrir/recommendations'
import type { Route } from 'next'
import { OfferCard } from './OfferCard'

interface AddonsGridProps {
  recommendedCode?: string
}

/**
 * Section 6 — Outils inclus (ex-« add-ons à la carte »).
 *
 * V1 ne liste que la Pré-validation ADEME (vraie feature incluse dans l'offre).
 * Son CTA mène vers la page outil réelle, pas un faux tunnel d'achat.
 *
 * Les éventuels autres add-ons (modules payants standalone) ne sont pas branchés
 * à un Price Stripe en V1 : leur CTA pointe donc vers la page d'upgrade logiciel
 * (offre coherente) plutôt que vers un faux checkout.
 */
export function AddonsGrid({ recommendedCode }: AddonsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {ADDON_OFFERS.map((offer) => {
        const isConformite = offer.code === 'addon_pack_conformite'
        const ctaHref: Route = isConformite
          ? ('/dashboard/cockpit-ademe/prevalidation' as Route)
          : ('/dashboard/upgrade/logiciel' as Route)
        return (
          <OfferCard
            key={offer.code}
            offer={offer}
            recommended={offer.code === recommendedCode}
            position="grid_addons"
            ctaHref={ctaHref}
            ctaLabel={isConformite ? 'Ouvrir la pré-validation' : undefined}
            secondaryCtaLabel="Voir le détail"
          />
        )
      })}
    </div>
  )
}
