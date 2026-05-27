import { scrubPii } from '@/lib/security/scrub-pii'
/**
 * Sentry — configuration côté navigateur.
 *
 * Activations :
 * - Error tracking (toujours)
 * - Performance traces (10% sampling)
 * - Session Replay (5% normal, 100% sur erreur) avec masquage RGPD strict
 *
 * RGPD :
 * - maskAllText: true et blockAllMedia: true sur Replay pour ne jamais capter
 *   le contenu métier (adresses clients, notes voc, photos terrain).
 * - beforeSend filtre tout sauf production (jamais d'envoi depuis dev).
 */
import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),

  // Performance monitoring
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,

  // Session replay (RGPD-safe : masque tout texte + média par défaut)
  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 1.0,

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
