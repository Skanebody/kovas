'use client'

import { LOGICIEL_OFFERS } from '@/lib/decouvrir/recommendations'
import type { Route } from 'next'
import { OfferCard } from './OfferCard'

interface LogicielPlansGridProps {
  /** Code de l'offre logicielle active (si présente) */
  currentCode?: string
  /** Code de l'offre actuellement recommandée par l'algorithme */
  recommendedCode?: string
}

/**
 * Mapping code d'offre Découvrir (LOGICIEL_OFFERS) → code plan attendu par
 * l'endpoint Stripe Checkout (`/api/stripe/checkout`).
 *
 * L'endpoint classe le plan via le préfixe (`logiciel_*`) et résout le Price ID
 * via `STRIPE_LOGICIEL_PRICES` — on cible donc les alias `logiciel_*` qui
 * partagent les mêmes Price IDs que les codes officiels V5 (solo_light, etc.).
 */
const LOGICIEL_OFFER_TO_CHECKOUT: Readonly<Record<string, string>> = {
  logiciel_solo_light: 'logiciel_starter',
  logiciel_solo_pro: 'logiciel_active',
  logiciel_cabinet: 'logiciel_cabinet',
  logiciel_cabinet_plus: 'logiciel_enterprise',
}

/**
 * CTA d'une offre logiciel :
 *   - Essai gratuit (prix 0) → /signup (souscription du trial 30j)
 *   - Plan payant            → Stripe Checkout avec le code plan résolu
 */
function logicielCtaHref(code: string, priceMonthlyCents: number | null): Route {
  if (priceMonthlyCents === 0) return '/signup' as Route
  const checkoutCode = LOGICIEL_OFFER_TO_CHECKOUT[code]
  if (checkoutCode) {
    return `/api/stripe/checkout?plan=${checkoutCode}&cycle=monthly` as Route
  }
  // Fallback cohérent : page d'upgrade logiciel (pas de faux CTA paiement).
  return '/dashboard/upgrade/logiciel' as Route
}

/**
 * Section 3 — Toutes les offres logiciel KOVAS (5 plans).
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
          ctaHref={logicielCtaHref(offer.code, offer.priceMonthlyCents)}
          secondaryCtaLabel="Comparer"
        />
      ))}
    </div>
  )
}
