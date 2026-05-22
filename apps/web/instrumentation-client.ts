/**
 * Sentry — instrumentation client (Next.js 15 + Turbopack compatible).
 *
 * Délègue à sentry.client.config.ts pour ne pas dupliquer la config. Le fichier
 * sentry.client.config.ts reste présent pour rétrocompat webpack ; ce fichier
 * est celui que Turbopack et Sentry SDK 9+ chargent en priorité.
 */
import './sentry.client.config'
