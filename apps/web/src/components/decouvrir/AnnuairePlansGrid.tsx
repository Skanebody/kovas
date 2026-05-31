'use client'

import { ANNUAIRE_OFFERS } from '@/lib/decouvrir/recommendations'
import type { Route } from 'next'
import { OfferCard } from './OfferCard'

interface AnnuairePlansGridProps {
  currentCode?: string
  recommendedCode?: string
}

/**
 * CTA d'une offre annuaire :
 *   - Annuaire Gratuit (prix 0) → /dashboard/annuaire (activation fiche gratuite)
 *   - Plan payant               → Stripe Checkout (les codes annuaire_local /
 *     annuaire_regional / annuaire_national sont déjà ceux attendus par
 *     l'endpoint via STRIPE_ANNUAIRE_PRICES).
 */
function annuaireCtaHref(code: string, priceMonthlyCents: number | null): Route {
  if (priceMonthlyCents === 0) return '/dashboard/annuaire' as Route
  return `/api/stripe/checkout?plan=${code}&cycle=monthly` as Route
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
          ctaHref={annuaireCtaHref(offer.code, offer.priceMonthlyCents)}
          secondaryCtaLabel="Voir un exemple de fiche"
        />
      ))}
    </div>
  )
}
