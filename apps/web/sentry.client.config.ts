import { hasFunctionalConsent } from '@/lib/cookies/consent-storage'
import { scrubPii } from '@/lib/security/scrub-pii'
/**
 * Sentry — configuration côté navigateur.
 *
 * Activations :
 * - Error tracking (TOUJOURS actif — base juridique : intérêt légitime
 *   art. 6.1.f RGPD pour la sécurité et le fonctionnement du service).
 * - Performance traces (10% sampling, technique, sans cookies tiers).
 * - Session Replay : GATED par le consentement cookies CNIL.
 *
 * RGPD / CNIL :
 * - Errors + traces : pas de consent requis (intérêt légitime). Aucun cookie
 *   tiers de tracking marketing déposé par Sentry.
 * - Session Replay : capture d'écran de la session utilisateur = donnée
 *   personnelle → consentement explicite obligatoire (catégorie
 *   `functional`). Sans consent, sampleRate forcé à 0.
 *   Le `CookieConsentProvider` rappelle `Sentry.getReplay()?.start()` à
 *   chaud quand l'utilisateur opt-in après init.
 * - maskAllText + blockAllMedia sur Replay : double filet, jamais de
 *   contenu métier (adresses clients, notes voc, photos terrain).
 * - beforeSend filtre tout sauf production (jamais d'envoi depuis dev).
 */
import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

// CNIL gate : on lit le consent stocké AVANT init Sentry. Pas de consent
// stocké (1er visiteur) ou opt-out → replay totalement désactivé (sampleRate
// = 0). Errors + traces restent actifs (intérêt légitime).
// Le provider peut ensuite démarrer le replay à chaud via `replay.start()`
// quand l'utilisateur accepte les cookies fonctionnels.
const replayConsent = hasFunctionalConsent()

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),

  // Performance monitoring (intérêt légitime — pas de cookie marketing)
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,

  // Session replay (RGPD-safe : masque tout texte + média par défaut).
  // Sampling à 0 sans consent CNIL — le replay sera activé à la volée
  // par le CookieConsentProvider via `Sentry.getReplay()?.start()` après
  // opt-in utilisateur.
  replaysSessionSampleRate: replayConsent ? 0.05 : 0,
  replaysOnErrorSampleRate: replayConsent ? 1.0 : 0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Filtrage du bruit (erreurs réseau transitoires, ResizeObserver loop, etc.)
  ignoreErrors: [
    'Network request failed',
    'Failed to fetch',
    'ResizeObserver loop',
    'Non-Error promise rejection captured',
  ],

  // Aucune télémétrie depuis dev / staging — uniquement prod.
  // Scrub PII (emails, téléphones, SIRET, JWT, clés API) avant envoi.
  beforeSend(event) {
    if (process.env.NODE_ENV !== 'production') return null
    return scrubPii(event)
  },

  environment: process.env.NODE_ENV,
})
