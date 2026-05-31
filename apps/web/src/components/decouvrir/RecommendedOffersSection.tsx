'use client'

import { Badge } from '@/components/ui/badge'
import { trackRecommendationChanged } from '@/lib/decouvrir/analytics'
import { useIntentTracker, useTopRecommendations } from '@/lib/decouvrir/intent-tracker'
import type { OfferDescriptor, ScoredOffer, UserTrack } from '@/lib/decouvrir/recommendations'
import { Sparkles } from 'lucide-react'
import type { Route } from 'next'
import { useEffect, useRef, useState } from 'react'
import { OfferCard } from './OfferCard'

/**
 * Mapping code d'offre Découvrir → code attendu par l'endpoint Stripe Checkout.
 * Aligné sur les grilles dédiées (LogicielPlansGrid / BundlesGrid) : on cible
 * les alias `logiciel_*` / codes bundle Stripe qui partagent les Price IDs.
 */
const LOGICIEL_OFFER_TO_CHECKOUT: Readonly<Record<string, string>> = {
  logiciel_solo_light: 'logiciel_starter',
  logiciel_solo_pro: 'logiciel_active',
  logiciel_cabinet: 'logiciel_cabinet',
  logiciel_cabinet_plus: 'logiciel_enterprise',
}

const BUNDLE_OFFER_TO_CHECKOUT: Readonly<Record<string, string>> = {
  bundle_solo_starter: 'bundle_solo_starter',
  bundle_solo_pro_local: 'bundle_solo_performance',
  bundle_solo_pro_regional: 'bundle_solo_regional',
  bundle_cabinet_regional: 'bundle_cabinet_360',
  bundle_cabinet_national: 'bundle_cabinet_national',
}

/**
 * Construit le CTA d'une offre recommandée selon sa famille :
 *   - logiciel gratuit (essai)   → /signup
 *   - logiciel payant            → Stripe Checkout (?plan=logiciel_*)
 *   - annuaire gratuit           → /dashboard/annuaire
 *   - annuaire payant            → Stripe Checkout (?plan=annuaire_*)
 *   - bundle                     → Stripe Checkout (?bundle=...)
 *   - addon (inclus, prix null)  → page pré-validation ADEME
 *   - sponsorisé                 → page d'upgrade annuaire (choix commune amont)
 */
function recommendedCtaHref(offer: OfferDescriptor): Route {
  switch (offer.family) {
    case 'logiciel': {
      if (offer.priceMonthlyCents === 0) return '/signup' as Route
      const code = LOGICIEL_OFFER_TO_CHECKOUT[offer.code]
      return code
        ? (`/api/stripe/checkout?plan=${code}&cycle=monthly` as Route)
        : ('/dashboard/upgrade/logiciel' as Route)
    }
    case 'annuaire': {
      if (offer.priceMonthlyCents === 0) return '/dashboard/annuaire' as Route
      return `/api/stripe/checkout?plan=${offer.code}&cycle=monthly` as Route
    }
    case 'bundle': {
      const code = BUNDLE_OFFER_TO_CHECKOUT[offer.code]
      return code
        ? (`/api/stripe/checkout?bundle=${code}&cycle=monthly` as Route)
        : ('/dashboard/upgrade/bundle' as Route)
    }
    case 'addon':
      return offer.code === 'addon_pack_conformite'
        ? ('/dashboard/cockpit-ademe/prevalidation' as Route)
        : ('/dashboard/upgrade/logiciel' as Route)
    default:
      // sponsorisé : choix de commune en amont du checkout
      return '/dashboard/upgrade/annuaire' as Route
  }
}

interface RecommendedOffersSectionProps {
  track: UserTrack
  /** Permet au parent de connaître le code recommandé top1 (pour faire matcher les
   *  grilles plus bas qui affichent aussi le badge). */
  onTopRecommendedChange?: (code: string | null) => void
  /** Codes d'offres à ne jamais recommander (ex. anti-downgrade logiciel). */
  excludeCodes?: ReadonlySet<string>
}

/**
 * Section 2 — Offres recommandées pour toi (dynamique).
 *
 * Affiche les 4 meilleures offres selon le scoring. Recalcule automatiquement
 * toutes les 5s (via tick du store) après les 30 premières secondes, pour
 * laisser le temps aux signaux de s'accumuler avant la première mise à jour.
 *
 * Animation : fade-in 300ms sur l'entrée de chaque card (pas de slide brutal).
 */
export function RecommendedOffersSection({
  track,
  onTopRecommendedChange,
  excludeCodes,
}: RecommendedOffersSectionProps) {
  const tick = useIntentTracker((s) => s.tick)
  const recommendations = useTopRecommendations(track, 4, excludeCodes)
  const previousTopRef = useRef<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<number>(() => Date.now())

  // Recalcul périodique après 30s (laisse les signaux s'accumuler)
  useEffect(() => {
    const initialDelayMs = 30_000
    const intervalMs = 5_000
    const initialTimer = window.setTimeout(() => {
      const interval = window.setInterval(() => {
        tick()
        setLastUpdated(Date.now())
      }, intervalMs)

      // Cleanup interval — stocké en closure
      const cleanup = () => window.clearInterval(interval)
      ;(initialTimer as unknown as { _cleanup?: () => void })._cleanup = cleanup
    }, initialDelayMs)

    return () => {
      const stored = initialTimer as unknown as { _cleanup?: () => void }
      stored._cleanup?.()
      window.clearTimeout(initialTimer)
    }
  }, [tick])

  // Notifier changements de top 1 (analytics + parent)
  useEffect(() => {
    const topCode = recommendations[0]?.offer.code ?? null
    if (topCode !== previousTopRef.current) {
      trackRecommendationChanged(previousTopRef.current, topCode)
      previousTopRef.current = topCode
      onTopRecommendedChange?.(topCode)
    }
  }, [recommendations, onTopRecommendedChange])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[#0F1419] font-mono text-[11px] uppercase tracking-[0.1em]">
          <Sparkles className="size-3.5 text-chartreuse-deep" />
          Recommandées pour toi
        </div>
        <Badge variant="muted" className="text-[10px]">
          Mis à jour selon ta navigation
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {recommendations.map((rec, idx) => (
          <RecommendedCard
            key={`${rec.offer.code}-${lastUpdated}`}
            scored={rec}
            isTop={idx === 0}
          />
        ))}
      </div>
    </div>
  )
}

function RecommendedCard({ scored, isTop }: { scored: ScoredOffer; isTop: boolean }) {
  return (
    <div className="animate-fade-in">
      <OfferCard
        offer={scored.offer}
        recommended={isTop}
        position="recommended"
        ctaHref={recommendedCtaHref(scored.offer)}
        secondaryCtaLabel={scored.reasons[0] ?? 'Pourquoi cette offre ?'}
      />
    </div>
  )
}
