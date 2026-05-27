/**
 * KOVAS — Wrapper analytics pour la page Découvrir.
 *
 * Émet les événements PostHog suivants :
 *  - `decouvrir_page_viewed` (track)
 *  - `decouvrir_offer_hovered` (offer_code, duration_ms)
 *  - `decouvrir_section_viewed` (section, time_spent_ms)
 *  - `decouvrir_cta_clicked` (offer_code, position)
 *  - `decouvrir_recommendation_changed` (from, to)
 *
 * PostHog peut être absent (SSR ou env non configurée) — on garde un noop
 * silencieux dans ce cas.
 */

import type { DecouvrirSection, UserTrack } from './recommendations'

interface PosthogLike {
  capture: (event: string, props?: Record<string, unknown>) => void
}

function getPosthog(): PosthogLike | null {
  if (typeof window === 'undefined') return null
  const candidate = (window as unknown as { posthog?: PosthogLike }).posthog
  if (!candidate || typeof candidate.capture !== 'function') return null
  return candidate
}

export function trackPageViewed(track: UserTrack): void {
  getPosthog()?.capture('decouvrir_page_viewed', { track })
}

export function trackOfferHovered(offerCode: string, durationMs: number): void {
  if (durationMs < 500) return
  getPosthog()?.capture('decouvrir_offer_hovered', {
    offer_code: offerCode,
    duration_ms: Math.round(durationMs),
  })
}

export function trackSectionViewed(section: DecouvrirSection, timeSpentMs: number): void {
  if (timeSpentMs < 1000) return
  getPosthog()?.capture('decouvrir_section_viewed', {
    section,
    time_spent_ms: Math.round(timeSpentMs),
  })
}

export function trackCtaClicked(offerCode: string, position: string): void {
  getPosthog()?.capture('decouvrir_cta_clicked', {
    offer_code: offerCode,
    position,
  })
}

export function trackRecommendationChanged(from: string | null, to: string | null): void {
  if (from === to) return
  getPosthog()?.capture('decouvrir_recommendation_changed', {
    from,
    to,
  })
}
