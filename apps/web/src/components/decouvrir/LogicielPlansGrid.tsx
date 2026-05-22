'use client'

import { LOGICIEL_OFFERS } from '@/lib/decouvrir/recommendations'
import { OfferCard } from './OfferCard'

interface LogicielPlansGridProps {
  /** Code de l'offre logicielle active (si présente) */
  currentCode?: string
  /** Code de l'offre actuellement recommandée par l'algorithme */
  recommendedCode?: string
}

/**
 * Section 3 — Toutes les offres logiciel KOVAS 360 (5 plans).
 */
export function LogicielPlansGrid({ currentCode, recommendedCode }: LogicielPlansGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {LOGICIEL_OFFERS.map((offer) => (
        <OfferCard
          key={offer.code}
          offer={offer}
          recommended={offer.code === recommendedCode}
          current={offer.code === currentCode}
          position="grid_logiciel"
          ctaHref={offer.priceMonthlyCents === 0 ? '/signup' : '/app/account'}
          secondaryCtaLabel="Comparer"
        />
      ))}
    </div>
  )
}
