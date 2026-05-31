'use client'

import { SPONSORISE_OFFERS } from '@/lib/decouvrir/recommendations'
import type { Route } from 'next'
import { OfferCard } from './OfferCard'

interface SponsorisedTiersGridProps {
  recommendedCode?: string
}

/**
 * Section 7 — Sponsorisé annuaire : tranches par taille de commune.
 *
 * Le sponsoring nécessite de choisir une commune cible AVANT le paiement
 * (le prix dépend du palier de population, mais la commune doit être
 * sélectionnée). On dirige donc vers la page d'upgrade Annuaire — où la
 * commune se choisit avant le checkout Stripe — plutôt que vers un faux CTA
 * de paiement direct sans commune associée.
 */
const SPONSORISE_CTA_HREF = '/dashboard/upgrade/annuaire' as Route

export function SponsorisedTiersGrid({ recommendedCode }: SponsorisedTiersGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {SPONSORISE_OFFERS.map((offer) => (
        <OfferCard
          key={offer.code}
          offer={offer}
          recommended={offer.code === recommendedCode}
          position="grid_sponsorise"
          ctaHref={SPONSORISE_CTA_HREF}
          secondaryCtaLabel="Choisir une commune"
        />
      ))}
    </div>
  )
}
