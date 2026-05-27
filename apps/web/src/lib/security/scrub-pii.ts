/**
 * PII scrubber pour les events Sentry.
 * ─────────────────────────────────────────────────────────────
 * Applique des redactions avant envoi vers Sentry (RGPD + secrets).
 *
 * Patterns scrubbés :
 *   - Headers sensibles (Authorization, Cookie, x-api-key, api-key)
 *   - user.email + user.ip_address
 *   - Emails dans les messages d'erreur
 *   - Téléphones FR (E.164 et format national 0X)
 *   - SIRET 14 chiffres
 *   - JWT tokens (eyJ...)
 *   - Clés API : Stripe (sk/pk/rk/whsec), Supabase (sb_secret/sb_publishable/sbp),
 *     Anthropic (sk-ant-), OpenAI (sk-...)
 *   - Clés sensibles dans extra context (par nom)
 *
 * Appelé depuis sentry.server.config.ts + sentry.client.config.ts dans beforeSend.
 */
import type * as Sentry from '@sentry/nextjs'

type SentryEvent = Sentry.Event
type SentryException = NonNullable<NonNullable<SentryEvent['exception']>['values']>[number]

/**
 * Type générique pour préserver le sous-type (ErrorEvent vs TransactionEvent)
 * lors du chaînage depuis beforeSend(event: ErrorEvent) → return ErrorEvent.
 */

const SENSITIVE_HEADER_REGEX = /authorization|cookie|x-api-key|api-key/i
const SENSITIVE_EXTRA_KEY_REGEX = /email|phone|password|token|secret|key|siret/i

/**
 * Applique les regex de redaction sur un texte (messages d'erreur, etc.).
 */
function scrubText(input: string): string {
  return (
    input
      // Emails
      .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[EMAIL]')
      // Téléphone FR E.164 (+33XXXXXXXXX)
      .replace(/\b\+33[1-9]\d{8}\b/g, '[PHONE]')
      // Téléphone FR format national (0X XX XX XX XX avec espaces/points/tirets optionnels)
      .replace(/\b0[1-9](?:[\s.-]?\d{2}){4}\b/g, '[PHONE]')
      // SIRET 14 chiffres
      .replace(/\b\d{14}\b/g, '[SIRET]')
      // JWT tokens (header.payload.signature commençant par eyJ)
      .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, '[JWT]')
      // Clés Stripe (sk_test_..., sk_live_..., pk_..., rk_..., whsec_...)
      .replace(/\b(?:sk|pk|rk|whsec)_(?:test|live)_[A-Za-z0-9]+/g, '[STRIPE_KEY]')
      // Clés Supabase (sb_secret_..., sb_publishable_..., sbp_...)
      .replace(/\b(?:sb_(?:secret|publishable)|sbp)_[A-Za-z0-9_-]+/g, '[SUPABASE_KEY]')
      // Clés Anthropic (sk-ant-...)
      .replace(/\bsk-ant-[A-Za-z0-9_-]+/g, '[ANTHROPIC_KEY]')
      // Clés OpenAI (sk-... ou sk-proj-...). À placer EN DERNIER car
      // pattern le plus large (évite de scrubber stripe avant).
      .replace(/\bsk-(?:proj-)?[A-Za-z0-9_-]+/g, '[OPENAI_KEY]')
  )
}

/**
 * Scrub PII complet sur un event Sentry. Idempotent.
 * Modifie l'event in-place ET le retourne (pratique pour chaining).
 *
 * Générique pour préserver le sous-type (ErrorEvent vs TransactionEvent)
 * attendu par beforeSend(event: ErrorEvent) qui exige un retour ErrorEvent.
 */
export function scrubPii<T extends SentryEvent>(event: T): T {
  // ─── Headers HTTP sensibles (Sentry a un scrub par défaut mais double-check)
  if (event.request?.headers) {
    const h = event.request.headers as Record<string, string>
    for (const key of Object.keys(h)) {
      if (SENSITIVE_HEADER_REGEX.test(key)) {
        h[key] = '[REDACTED]'
      }
    }
  }

  // ─── User PII (Sentry envoie souvent user.email + IP en clair)
  if (event.user) {
    if (event.user.email) event.user.email = '[REDACTED]'
    if (event.user.ip_address) event.user.ip_address = '[REDACTED]'
  }

  // ─── Messages d'exception (stack message + value)
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((ex: SentryException) => {
      if (ex.value) {
        ex.value = scrubText(ex.value)
      }
      return ex
    })
  }

  // ─── Message top-level (Sentry.captureMessage)
  if (typeof event.message === 'string') {
    event.message = scrubText(event.message)
  }

  // ─── Extra context : redact clés au nom sensible
  if (event.extra) {
    for (const key of Object.keys(event.extra)) {
      if (SENSITIVE_EXTRA_KEY_REGEX.test(key)) {
        event.extra[key] = '[REDACTED]'
      }
    }
  }

  return event
}
