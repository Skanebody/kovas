'use client'

import { ANNUAIRE_OFFERS } from '@/lib/decouvrir/recommendations'
import { OfferCard } from './OfferCard'

interface AnnuairePlansGridProps {
  currentCode?: string
  recommendedCode?: string
}

/**
 * Section 4 — Toutes les offres annuaire KOVAS Annuaire (4 plans).
 */
export function AnnuairePlansGrid({ currentCode, recommendedCode }: AnnuairePlansGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {ANNUAIRE_OFFERS.map((offer) => (
        <OfferCard
          key={offer.code}
          offer={offer}
          recommended={offer.code === recommendedCode}
          current={offer.code === currentCode}
          position="grid_annuaire"
          ctaHref={offer.priceMonthlyCents === 0 ? '/app/account' : '/app/account'}
          secondaryCtaLabel="Voir un exemple de fiche"
        />
      ))}
    </div>
  )
}
