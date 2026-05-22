/**
 * Sentry — configuration côté Node.js (Route Handlers, Server Components,
 * Server Actions, middlewares).
 *
 * Pas de Session Replay côté serveur (pertinence client uniquement). Profiling
 * activé à 10% pour mesurer les goulets dans les API routes critiques (export,
 * structuration vocale, génération devis/facture).
 */
import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),

  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,

  ignoreErrors: [
    'Network request failed',
    'Failed to fetch',
    'ResizeObserver loop',
    'Non-Error promise rejection captured',
  ],

  beforeSend(event) {
    if (process.env.NODE_ENV !== 'production') return null
    return event
  },

  environment: process.env.NODE_ENV,
})
