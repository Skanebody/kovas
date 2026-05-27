'use client'

/**
 * CookieConsentProvider — orchestre l'initialisation conditionnelle des
 * trackers tiers (PostHog analytics, Sentry session replay) en fonction du
 * consentement utilisateur stocké, puis monte le bandeau CNIL.
 *
 * À monter une fois dans le RootLayout (au niveau body). Le bandeau lui-même
 * ne s'affiche que sur les routes publiques + légales — pour les routes
 * `/dashboard/*`, le consent est implicite (CGU acceptées au signup) et le
 * bandeau est masqué via `usePathname()`.
 *
 * Architecture :
 *   1. Lit le consent au mount.
 *   2. Si analytics consent → initialise PostHog (lazy, code-split friendly).
 *   3. Si functional consent → enable Sentry session replay.
 *   4. Écoute les changements de consent (event `kovas:consent-change`) pour
 *      activer/désactiver les trackers à chaud sans rechargement de page.
 */
import { CookieConsentBanner } from '@/components/cookies/CookieConsentBanner'
import {
  CONSENT_CHANGE_EVENT,
  type ConsentChangeEventDetail,
  hasAnalyticsConsent,
  hasFunctionalConsent,
} from '@/lib/cookies/consent-storage'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Préfixe des routes où le bandeau cookie DOIT être masqué.
 * - `/dashboard/*` : utilisateur authentifié, CGU acceptées (consent implicite)
 * - `/admin/*` : zone admin interne
 */
const HIDE_BANNER_PATH_PREFIXES = ['/dashboard', '/admin'] as const

function shouldHideBanner(pathname: string | null): boolean {
  if (!pathname) return false
  return HIDE_BANNER_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))
}

/**
 * Initialise PostHog si analytics consent est donné. Idempotent : appelable
 * plusieurs fois sans risque (le module `posthog.ts` gère son `isInitialized`
 * interne).
 */
async function tryInitPostHog(): Promise<void> {
  if (!hasAnalyticsConsent()) return
  try {
    const mod = await import('@/lib/analytics/posthog')
    mod.initPostHog()
  } catch {
    // Échec d'import : pas critique (production n'aura jamais ce cas, dev
    // sans clé PostHog non plus). On laisse silencieux.
  }
}

/**
 * Bascule l'opt-in/opt-out PostHog runtime si l'utilisateur change ses
 * préférences depuis la modale (sans rechargement de page).
 */
async function syncPostHogOptInOut(consent: ConsentChangeEventDetail['consent']): Promise<void> {
  try {
    const posthogModule = await import('posthog-js')
    const posthog = posthogModule.default
    if (consent.analytics) {
      // Si PostHog n'est pas encore initialisé (cas : 1er opt-in après refus
      // initial), on l'initialise maintenant.
      const ph = await import('@/lib/analytics/posthog')
      ph.initPostHog()
      posthog.opt_in_capturing()
    } else {
      posthog.opt_out_capturing()
    }
  } catch {
    // pas de PostHog dispo → no-op
  }
}

/**
 * Sentry session replay : on ne peut pas re-bind les integrations à chaud
 * proprement, donc on délègue à Sentry.replayIntegration().start/stop().
 */
async function syncSentryReplay(consent: ConsentChangeEventDetail['consent']): Promise<void> {
  try {
    const Sentry = await import('@sentry/nextjs')
    const replay = Sentry.getReplay()
    if (!replay) return
    if (consent.functional) {
      replay.start()
    } else {
      void replay.stop()
    }
  } catch {
    // pas de Sentry dispo → no-op
  }
}

export function CookieConsentProvider() {
  const pathname = usePathname()
  const isBannerHidden = shouldHideBanner(pathname)

  // Init PostHog au mount selon consent stocké.
  useEffect(() => {
    void tryInitPostHog()
  }, [])

  // Sync Sentry session replay au mount selon consent stocké (Sentry est
  // déjà init dans sentry.client.config.ts, on bascule juste le replay).
  useEffect(() => {
    if (typeof window === 'undefined') return
    void (async () => {
      try {
        const Sentry = await import('@sentry/nextjs')
        const replay = Sentry.getReplay()
        if (!replay) return
        if (hasFunctionalConsent()) {
          replay.start()
        } else {
          void replay.stop()
        }
      } catch {
        // no-op
      }
    })()
  }, [])

  // Écoute changement de consent à chaud (intra-onglet) — opt-in / opt-out
  // sans rechargement.
  useEffect(() => {
    if (typeof window === 'undefined') return
    function handler(event: Event) {
      const detail = (event as CustomEvent<ConsentChangeEventDetail>).detail
      if (!detail) return
      void syncPostHogOptInOut(detail.consent)
      void syncSentryReplay(detail.consent)
    }
    window.addEventListener(CONSENT_CHANGE_EVENT, handler)
    return () => {
      window.removeEventListener(CONSENT_CHANGE_EVENT, handler)
    }
  }, [])

  // Sur dashboard/admin, on ne monte même pas le bandeau (consent CGU implicite).
  if (isBannerHidden) return null

  return <CookieConsentBanner />
}
