'use client'

import { ADDON_OFFERS } from '@/lib/decouvrir/recommendations'
import { OfferCard } from './OfferCard'

interface AddonsGridProps {
  recommendedCode?: string
}

/**
 * Section 6 — Add-ons activables à la carte.
 */
export function AddonsGrid({ recommendedCode }: AddonsGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {ADDON_OFFERS.map((offer) => (
        <OfferCard
          key={offer.code}
          offer={offer}
          recommended={offer.code === recommendedCode}
          position="grid_addons"
          ctaHref="/app/account"
          secondaryCtaLabel="Voir le détail"
        />
      ))}
    </div>
  )
}
