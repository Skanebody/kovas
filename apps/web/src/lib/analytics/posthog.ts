'use client'

/**
 * PostHog — analytics business + feature flags + session replay.
 *
 * Initialisation lazy : appelée une seule fois au montage du provider racine
 * (cf. components/posthog-provider.tsx). Tous les helpers ci-dessous sont des
 * no-ops si PostHog n'est pas initialisé ou si la clé publique est absente
 * (dev local, build CI sans secrets, etc.).
 *
 * RGPD :
 * - session_recording.maskAllInputs : masque tous les <input> (jamais de saisie
 *   client capturée). Texte affiché reste visible — masque-le via classe CSS
 *   `ph-no-capture` au cas par cas si besoin.
 * - capture_pageview géré par PostHog (auto). Capture personnalisée déclenchée
 *   par les helpers métier ci-dessous.
 */
import posthog from 'posthog-js'

let isInitialized = false

export function initPostHog(): void {
  if (isInitialized) return
  if (typeof window === 'undefined') return

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.posthog.com'

  if (!key) return

  posthog.init(key, {
    api_host: host,
    capture_pageview: true,
    session_recording: {
      maskAllInputs: true,
    },
    // Respect Do Not Track (RGPD)
    respect_dnt: true,
    // Pas d'init en dev pour éviter de polluer les datasets prod
    loaded: (ph) => {
      if (process.env.NODE_ENV !== 'production') ph.opt_out_capturing()
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
