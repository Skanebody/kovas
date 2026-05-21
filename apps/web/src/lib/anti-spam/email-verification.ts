/**
 * KOVAS — Vérification email particulier (anti-spam V1).
 *
 * Workflow :
 *  1. À la soumission du formulaire, on génère un code 6 chiffres cryptographique.
 *  2. On stocke dans `quote_requests.requester_verification_code` + expiration 30 min.
 *  3. On envoie email avec le code (template `verification-code.ts`).
 *  4. L'utilisateur saisit le code sur /verifier-mon-email/<token>.
 *  5. Vérification : max 5 tentatives, sinon le code est invalidé.
 *  6. Au succès → status passe de 'pending_email_verification' à 'pending'
 *     + déclenchement du multi-envoi vers 5 diag.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { randomInt } from 'node:crypto'
import { sendEmail } from '@/lib/email/send'
import { renderVerificationCodeEmail } from '@/emails/quote-request/verification-code'

const CODE_TTL_MINUTES = 30
const MAX_VERIFICATION_ATTEMPTS = 5

/**
 * Génère un code 6 chiffres cryptographiquement sécurisé.
 * Range [100000, 999999] inclusif.
 */
export function generateVerificationCode(): string {
  return randomInt(100000, 1_000_000).toString()
}

export interface SendVerificationParams {
  quoteRequestId: string
  trackingToken: string
  email: string
  firstName: string
  code: string
  baseUrl: string
}

export async function sendVerificationEmail(
  // biome-ignore lint/suspicious/noExplicitAny: client générique service_role
  supabase: SupabaseClient<any, any, any>,
  params: SendVerificationParams,
): Promise<void> {
  const { subject, html, text } = renderVerificationCodeEmail({
    first_name: params.firstName,
    code: params.code,
    tracking_token: params.trackingToken,
    base_url: params.baseUrl,
  })

  await sendEmail({
    to: params.email,
    subject,
    html,
    text,
    category: 'transactional',
    tags: [{ name: 'kovas_flow', value: 'verify_email' }],
  })

  // biome-ignore lint/suspicious/noExplicitAny: dynamic table
  await (supabase as any)
    .from('quote_requests')
    .update({ requester_verification_sent_at: new Date().toISOString() })
    .eq('id', params.quoteRequestId)
}

export interface VerifyResult {
  valid: boolean
  attemptsRemaining: number
  /** True si le code est expiré (à renvoyer). */
  expired: boolean
  /** True si la demande n'existe pas ou est déjà vérifiée. */
  notFound: boolean
  alreadyVerified: boolean
}

export async function verifyCode(
  // biome-ignore lint/suspicious/noExplicitAny: client générique
  supabase: SupabaseClient<any, any, any>,
  trackingToken: string,
  code: string,
): Promise<VerifyResult> {
  // biome-ignore lint/suspicious/noExplicitAny: dynamic table
  const { data, error } = await (supabase as any)
    .from('quote_requests')
    .select(
      'id, requester_verification_code, requester_verification_code_expires_at, verification_attempts, requester_email_verified, status',
    )
    .eq('public_tracking_token', trackingToken)
    .maybeSingle()

  if (error || !data) {
    return {
      valid: false,
      attemptsRemaining: 0,
      expired: false,
      notFound: true,
      alreadyVerified: false,
    }
  }

  const row = data as {
    id: string
    requester_verification_code: string | null
    requester_verification_code_expires_at: string | null
    verification_attempts: number | null
    requester_email_verified: boolean | null
    status: string
  }

  if (row.requester_email_verified === true) {
    return {
      valid: true,
      attemptsRemaining: MAX_VERIFICATION_ATTEMPTS,
      expired: false,
      notFound: false,
      alreadyVerified: true,
    }
  }

  const attempts = row.verification_attempts ?? 0
  if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
    return {
      valid: false,
      attemptsRemaining: 0,
      expired: true,
      notFound: false,
      alreadyVerified: false,
    }
  }

  const expiresAt = row.requester_verification_code_expires_at
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return {
      valid: false,
      attemptsRemaining: MAX_VERIFICATION_ATTEMPTS - attempts,
      expired: true,
      notFound: false,
      alreadyVerified: false,
    }
  }

  // Comparaison du code — `.trim()` defensive
  const submittedCode = code.trim()
  const expectedCode = (row.requester_verification_code ?? '').trim()
  const match = submittedCode.length === 6 && submittedCode === expectedCode

  // Increment tentatives (qu'on match ou pas, pour rate limit)
  const newAttempts = attempts + 1

  if (match) {
    // biome-ignore lint/suspicious/noExplicitAny: dynamic table
    await (supabase as any)
      .from('quote_requests')
      .update({
        requester_email_verified: true,
        // On efface le code (sécurité : ne pas le garder en DB)
        requester_verification_code: null,
        verification_attempts: newAttempts,
        // Status passe à 'pending' (devis actif)
        status: 'pending',
      })
      .eq('id', row.id)

    return {
      valid: true,
      attemptsRemaining: MAX_VERIFICATION_ATTEMPTS - newAttempts,
      expired: false,
      notFound: false,
      alreadyVerified: false,
    }
  }

  // Code invalide → increment seulement
  // biome-ignore lint/suspicious/noExplicitAny: dynamic table
  await (supabase as any)
    .from('quote_requests')
    .update({ verification_attempts: newAttempts })
    .eq('id', row.id)

  return {
    valid: false,
    attemptsRemaining: Math.max(0, MAX_VERIFICATION_ATTEMPTS - newAttempts),
    expired: false,
    notFound: false,
    alreadyVerified: false,
  }
}

/**
 * Régénère un code + nouvelle date d'expiration. Reset des tentatives.
 * Utilisé par /api/quote-requests/resend-code (rate-limited 1/min).
 */
export async function regenerateVerificationCode(
  // biome-ignore lint/suspicious/noExplicitAny: client générique
  supabase: SupabaseClient<any, any, any>,
  quoteRequestId: string,
): Promise<{ code: string; expiresAt: Date }> {
  const code = generateVerificationCode()
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000)

  // biome-ignore lint/suspicious/noExplicitAny: dynamic table
  await (supabase as any)
    .from('quote_requests')
    .update({
      requester_verification_code: code,
      requester_verification_code_expires_at: expiresAt.toISOString(),
      verification_attempts: 0,
    })
    .eq('id', quoteRequestId)

  return { code, expiresAt }
}

export function getCodeExpirationDate(): Date {
  return new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000)
}
