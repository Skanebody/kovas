'use client'

import { BUNDLE_OFFERS } from '@/lib/decouvrir/recommendations'
import type { Route } from 'next'
import { OfferCard } from './OfferCard'

interface BundlesGridProps {
  recommendedCode?: string
}

/**
 * Mapping code d'offre Découvrir (BUNDLE_OFFERS) → code bundle attendu par
 * l'endpoint Stripe Checkout (clés de `STRIPE_BUNDLE_PRICES`).
 *
 * Les libellés/codes de la page Découvrir diffèrent des codes Stripe officiels
 * V5 ; on aligne sur la composition réelle (cf. BUNDLES dans pricing-plans.ts).
 */
const BUNDLE_OFFER_TO_CHECKOUT: Readonly<Record<string, string>> = {
  bundle_solo_starter: 'bundle_solo_starter', // Solo + Présence
  bundle_solo_pro_local: 'bundle_solo_performance', // Pro + Boost (Croissance)
  bundle_solo_pro_regional: 'bundle_solo_regional', // Solo + Premium (Acquisition)
  bundle_cabinet_regional: 'bundle_cabinet_360', // Cabinet + Premium
  bundle_cabinet_national: 'bundle_cabinet_national', // Cabinet+ + Premium
}

/**
 * CTA d'un bundle → Stripe Checkout (param `bundle`, pas `plan`).
 * Fallback cohérent vers la page d'upgrade bundle si le code n'est pas mappé.
 */
function bundleCtaHref(code: string): Route {
  const checkoutCode = BUNDLE_OFFER_TO_CHECKOUT[code]
  if (checkoutCode) {
    return `/api/stripe/checkout?bundle=${checkoutCode}&cycle=monthly` as Route
  }
  return '/dashboard/upgrade/bundle' as Route
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
          ctaHref={bundleCtaHref(offer.code)}
          secondaryCtaLabel="Détailler ce pack"
        />
      ))}
    </div>
  )
}
