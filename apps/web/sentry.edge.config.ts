/**
 * Sentry — configuration runtime Edge (Vercel Edge Functions, middleware).
 *
 * Runtime restreint : pas de Replay, pas de Profiling. Tracing uniquement
 * pour mesurer la latence des middlewares (auth refresh, redirects).
 */
import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: Boolean(SENTRY_DSN),

  tracesSampleRate: 0.1,

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
