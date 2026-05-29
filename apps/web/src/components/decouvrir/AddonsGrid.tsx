'use client'

import { ADDON_OFFERS } from '@/lib/decouvrir/recommendations'
import { OfferCard } from './OfferCard'

interface AddonsGridProps {
  recommendedCode?: string
}

/**
 * Section 6 — Outils inclus (ex-« add-ons à la carte »).
 *
 * V1 ne liste que la Pré-validation ADEME (vraie feature incluse dans l'offre).
 * Son CTA mène vers la page outil réelle, pas un faux tunnel d'achat.
 */
export function AddonsGrid({ recommendedCode }: AddonsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {ADDON_OFFERS.map((offer) => {
        const isConformite = offer.code === 'addon_pack_conformite'
        return (
          <OfferCard
            key={offer.code}
            offer={offer}
            recommended={offer.code === recommendedCode}
            position="grid_addons"
            ctaHref={isConformite ? '/dashboard/cockpit-ademe/prevalidation' : '/dashboard/account'}
            ctaLabel={isConformite ? 'Ouvrir la pré-validation' : undefined}
            secondaryCtaLabel="Voir le détail"
          />
        )
      })}
    </div>
  )
}
