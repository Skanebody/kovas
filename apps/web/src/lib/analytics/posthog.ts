'use client'

/**
 * PostHog — analytics business + feature flags + session replay.
 *
 * Initialisation lazy + GATED par le consentement cookies CNIL.
 *
 * Appelée uniquement depuis `CookieConsentProvider` quand l'utilisateur a
 * donné son consentement analytics (`kovas_consent_v1.analytics === true`).
 * Tous les helpers ci-dessous sont des no-ops si PostHog n'est pas initialisé
 * ou si la clé publique est absente (dev local, build CI sans secrets, etc.).
 *
 * RGPD / CNIL :
 * - L'init n'a lieu QU'APRÈS consentement explicite via le banner.
 * - `opt_out_capturing_by_default: true` est un filet de sécurité : même si
 *   l'init est appelée accidentellement sans consent, aucune capture ne
 *   partira tant qu'on n'a pas appelé `opt_in_capturing()`.
 * - session_recording.maskAllInputs : masque tous les <input> (jamais de
 *   saisie client capturée). Texte affiché reste visible — masque-le via
 *   classe CSS `ph-no-capture` au cas par cas si besoin.
 * - capture_pageview géré par PostHog (auto). Capture personnalisée
 *   déclenchée par les helpers métier ci-dessous.
 */
import { hasAnalyticsConsent } from '@/lib/cookies/consent-storage'
import posthog from 'posthog-js'

let isInitialized = false

export function initPostHog(): void {
  if (isInitialized) return
  if (typeof window === 'undefined') return

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.posthog.com'

  if (!key) return

  // CNIL gate : n'init PAS PostHog sans consent analytics explicite. Le
  // `CookieConsentProvider` est responsable de rappeler `initPostHog()` après
  // un opt-in user.
  const hasConsent = hasAnalyticsConsent()

  posthog.init(key, {
    api_host: host,
    capture_pageview: true,
    session_recording: {
      maskAllInputs: true,
      // maskTextSelector '*' : masque AUSSI tout texte affiché (adresses, noms
      // clients, numéros DPE, etc.). Équivalent moderne d'un "maskAllText".
      // Compensé par opt-in via classe CSS .ph-no-capture pour les zones non
      // sensibles si besoin (rare).
      maskTextSelector: '*',
    },
    // Respect Do Not Track (RGPD)
    respect_dnt: true,
    // Filet de sécurité CNIL : opt-out par défaut. On bascule en opt-in via
    // `opt_in_capturing()` immédiatement après init SI consent stocké.
    opt_out_capturing_by_default: true,
    // Cookie sécurisé HTTPS-only + jamais sur sous-domaines (annuaire.kovas.fr
    // ne doit pas hériter du cookie dashboard.kovas.fr et vice-versa).
    secure_cookie: true,
    cross_subdomain_cookie: false,
    // Cap la taille de chaque propriété d'event à 1KB. Empêche les leaks
    // accidentels de payloads volumineux (JSON brut, stack traces complètes).
    properties_string_max_length: 1024,
    // Pas de capture en dev pour éviter de polluer les datasets prod, et
    // applique l'opt-in/opt-out selon consent CNIL.
    loaded: (ph) => {
      if (process.env.NODE_ENV !== 'production') {
        ph.opt_out_capturing()
        return
      }
      if (hasConsent) {
        ph.opt_in_capturing()
      } else {
        ph.opt_out_capturing()
      }
    },
  })

  isInitialized = true
}

/**
 * Identifie l'utilisateur (post-login). distinctId = user.id Supabase.
 */
export function identifyUser(
  userId: string,
  properties?: Record<string, string | number | boolean>,
): void {
  if (!isInitialized) return
  posthog.identify(userId, properties)
}

/**
 * Reset PostHog session (post-logout). Indispensable pour ne pas mélanger
 * les sessions de plusieurs users sur le même device.
 */
export function resetPostHog(): void {
  if (!isInitialized) return
  posthog.reset()
}

// ============================================
// Helpers events business — appelés depuis le code métier
// ============================================

export function trackMissionStarted(diagnosticType: string): void {
  if (!isInitialized) return
  posthog.capture('mission_started', { diagnostic_type: diagnosticType })
}

export function trackMissionSynced(missionId: string, durationMin: number): void {
  if (!isInitialized) return
  posthog.capture('mission_synced', {
    mission_id: missionId,
    duration_min: durationMin,
  })
}

export function trackExportCompleted(missionId: string, targetFormat: string): void {
  if (!isInitialized) return
  posthog.capture('export_completed', {
    mission_id: missionId,
    target_format: targetFormat,
  })
}

export function trackSubscriptionStarted(plan: string, amountCents: number): void {
  if (!isInitialized) return
  posthog.capture('subscription_started', {
    plan,
    amount_cents: amountCents,
  })
}

export function trackTrialEnded(planCode: string, converted: boolean): void {
  if (!isInitialized) return
  posthog.capture('trial_ended', {
    plan_code: planCode,
    converted,
  })
}

export function trackPreExportAnalysis(
  missionId: string,
  score: number,
  criticalCount: number,
): void {
  if (!isInitialized) return
  posthog.capture('pre_export_analysis', {
    mission_id: missionId,
    score,
    critical_count: criticalCount,
  })
}

export function trackDossierExported(dossierId: string, format: string): void {
  if (!isInitialized) return
  posthog.capture('dossier_exported', {
    dossier_id: dossierId,
    format,
  })
}

export function trackQuoteGenerated(quoteId: string): void {
  if (!isInitialized) return
  posthog.capture('quote_generated', { quote_id: quoteId })
}

export function trackInvoiceCreated(invoiceId: string): void {
  if (!isInitialized) return
  posthog.capture('invoice_created', { invoice_id: invoiceId })
}
