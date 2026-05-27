'use client'

import { SPONSORISE_OFFERS } from '@/lib/decouvrir/recommendations'
import { OfferCard } from './OfferCard'

interface SponsorisedTiersGridProps {
  recommendedCode?: string
}

/**
 * Section 7 — Sponsorisé annuaire : 6 tranches par taille de commune.
 */
export function SponsorisedTiersGrid({ recommendedCode }: SponsorisedTiersGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {SPONSORISE_OFFERS.map((offer) => (
        <OfferCard
          key={offer.code}
          offer={offer}
          recommended={offer.code === recommendedCode}
          position="grid_sponsorise"
          ctaHref="/dashboard/account"
          secondaryCtaLabel="Choisir une commune"
        />
      ))}
    </div>
  )
}
