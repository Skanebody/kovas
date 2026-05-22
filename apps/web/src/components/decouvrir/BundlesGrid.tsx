'use client'

import { BUNDLE_OFFERS } from '@/lib/decouvrir/recommendations'
import { OfferCard } from './OfferCard'

interface BundlesGridProps {
  recommendedCode?: string
}

/**
 * Section 5 — Bundles cross-sell (5 combos remisés).
 */
export function BundlesGrid({ recommendedCode }: BundlesGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {BUNDLE_OFFERS.map((offer) => (
        <OfferCard
          key={offer.code}
          offer={offer}
          recommended={offer.code === recommendedCode}
          position="grid_bundle"
          ctaHref="/app/account"
          secondaryCtaLabel="Détailler ce pack"
        />
      ))}
    </div>
  )
}
