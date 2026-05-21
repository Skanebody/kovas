/**
 * KOVAS — API publique de soumission d'une demande de devis B2C (K1).
 *
 * POST /api/diagnosticians/[id]/quote-request
 *
 * Workflow K1 :
 *   1. Validation Zod payload + honeypot
 *   2. Vérification reCAPTCHA v3 (score < 0.5 → 403)
 *   3. Rate limits IP / email / email_diag (Si exceeded → 429)
 *   4. Insert quote_request avec status='pending_email_verification' + code 6 chiffres
 *   5. Envoi email de vérification au requester
 *   6. Record rate-limit hits
 *   7. Retourne { trackingToken } pour redirect vers /verifier-mon-email/[token]
 *
 * Le multi-envoi vers les 5 diag est déclenché APRÈS vérification email
 * (route /api/quote-requests/verify-email).
 */

import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import {
  checkAllRateLimits,
  emailDiagKey,
  emailKey,
  ipKey,
  recordRateLimitHit,
} from '@/lib/anti-spam/rate-limits'
import {
  generateVerificationCode,
  getCodeExpirationDate,
  sendVerificationEmail,
} from '@/lib/anti-spam/email-verification'
import { verifyRecaptchaToken } from '@/lib/anti-spam/recaptcha'
import { quoteRequestPayloadSchema } from '@/lib/quote-request/schema'

export const runtime = 'nodejs'
export const maxDuration = 30

interface DiagnosticianRow {
  id: string
  display_name: string
  first_name: string
  last_name: string
  city: string
  postal_code: string | null
  is_published: boolean
  withdrawal_requested: boolean
  ghost_status: string | null
  manual_pause_until: string | null
}

function getClientIp(req: Request): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return null
}

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, ctx: RouteContext): Promise<Response> {
  const { id: diagnosticianId } = await ctx.params

  // 1. Parse + validate payload
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const parsed = quoteRequestPayloadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const payload = parsed.data

  // 2. Honeypot : si rempli → succès silencieux + flag spam
  const honeypotFilled = (payload.honeypot ?? '').length > 0

  // 3. reCAPTCHA v3 — bloque si score < 0.5
  const recaptcha = await verifyRecaptchaToken(
    payload.recaptcha_token,
    'quote_request_submit',
    0.5,
  )
  if (!recaptcha.valid && !recaptcha.bypassed) {
    // On retourne un 403 — bot probable. Pas de "Validation failed" détaillé.
    return NextResponse.json(
      { error: 'Vérification anti-bot échouée. Réessayez ou contactez le support.' },
      { status: 403 },
    )
  }

  // 4. Admin client
  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // 5. Récupérer le diag d'origine (pour validation existence + city/postal pour routing)
  // biome-ignore lint/suspicious/noExplicitAny: A1 table not in generated types
  const diagResp = await (admin as any)
    .from('diagnosticians')
    .select(
      'id, display_name, first_name, last_name, city, postal_code, is_published, withdrawal_requested, ghost_status, manual_pause_until',
    )
    .eq('id', diagnosticianId)
    .maybeSingle()

  if (diagResp.error || !diagResp.data) {
    return NextResponse.json({ error: 'Diagnostiqueur introuvable' }, { status: 404 })
  }
  const diag = diagResp.data as DiagnosticianRow
  if (!diag.is_published || diag.withdrawal_requested) {
    return NextResponse.json({ error: 'Diagnostiqueur indisponible' }, { status: 404 })
  }

  // 6. Rate limits multi-couches
  const clientIp = getClientIp(request)
  const requesterEmail = payload.requester_email.trim().toLowerCase()

  const rateLimitFailure = await checkAllRateLimits(admin, {
    ip: clientIp,
    email: requesterEmail,
    diagnosticianId: diag.id,
  })

  if (rateLimitFailure) {
    const messages: Record<typeof rateLimitFailure.reason, string> = {
      ip_24h:
        'Trop de demandes depuis votre connexion. Réessayez dans 24 heures ou contactez le support.',
      email_diag_24h:
        'Vous avez déjà envoyé une demande à ce diagnostiqueur récemment. Patientez avant d’en envoyer une nouvelle.',
      email_7d:
        'Limite hebdomadaire atteinte (5 demandes par semaine). Réessayez dans quelques jours.',
    }
    return NextResponse.json(
      {
        error: messages[rateLimitFailure.reason],
        reason: rateLimitFailure.reason,
        resetAt: rateLimitFailure.resetAt.toISOString(),
      },
      { status: 429 },
    )
  }

  // 7. Determine spam status
  const isLikelySpam = honeypotFilled || recaptcha.score < 0.3
  if (isLikelySpam) {
    // On insère en 'spam' pour audit mais on retourne un succès silencieux
    // biome-ignore lint/suspicious/noExplicitAny: dynamic table
    await (admin as any).from('quote_requests').insert({
      diagnostician_id: diag.id,
      requester_first_name: payload.requester_first_name,
      requester_last_name: payload.requester_last_name,
      requester_email: requesterEmail,
      requester_phone: payload.requester_phone ?? null,
      property_type: payload.property_type,
      property_situation: payload.property_situation,
      property_address: payload.property_address ?? null,
      property_postal_code: payload.property_postal_code ?? null,
      property_city: payload.property_city ?? null,
      property_surface_m2: payload.property_surface_m2 ?? null,
      property_year_built: payload.property_year_built ?? null,
      property_geo_lat: payload.property_geo_lat ?? null,
      property_geo_lng: payload.property_geo_lng ?? null,
      diagnostics_requested: payload.diagnostics_requested,
      diagnostics_suggested: payload.diagnostics_suggested ?? null,
      message: payload.message ?? null,
      status: 'spam',
      ip_address: clientIp,
      user_agent: request.headers.get('user-agent')?.slice(0, 500) ?? null,
      honeypot_filled: honeypotFilled,
      recaptcha_score: recaptcha.score,
    })
    return NextResponse.json({
      message: 'Votre demande a bien été reçue. Vérifiez votre email pour confirmer.',
    })
  }

  // 8. Insert quote_request avec code de vérification
  const verificationCode = generateVerificationCode()
  const codeExpiresAt = getCodeExpirationDate()
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null

  // biome-ignore lint/suspicious/noExplicitAny: A1 parallel migration
  const insertResp = await (admin as any)
    .from('quote_requests')
    .insert({
      diagnostician_id: diag.id,
      requester_first_name: payload.requester_first_name,
      requester_last_name: payload.requester_last_name,
      requester_email: requesterEmail,
      requester_phone: payload.requester_phone ?? null,
      property_type: payload.property_type,
      property_situation: payload.property_situation,
      property_address: payload.property_address ?? null,
      property_postal_code: payload.property_postal_code ?? null,
      property_city: payload.property_city ?? null,
      property_surface_m2: payload.property_surface_m2 ?? null,
      property_year_built: payload.property_year_built ?? null,
      property_geo_lat: payload.property_geo_lat ?? null,
      property_geo_lng: payload.property_geo_lng ?? null,
      diagnostics_requested: payload.diagnostics_requested,
      diagnostics_suggested: payload.diagnostics_suggested ?? null,
      message: payload.message ?? null,
      status: 'pending_email_verification',
      ip_address: clientIp,
      user_agent: userAgent,
      honeypot_filled: false,
      recaptcha_score: recaptcha.score,
      requester_email_verified: false,
      requester_verification_code: verificationCode,
      requester_verification_code_expires_at: codeExpiresAt.toISOString(),
      verification_attempts: 0,
    })
    .select('id, public_tracking_token')
    .single()

  if (insertResp.error || !insertResp.data) {
    console.error('[quote-request] insert failed', insertResp.error)
    return NextResponse.json(
      { error: `Insert failed: ${insertResp.error?.message ?? 'unknown'}` },
      { status: 500 },
    )
  }
  const inserted = insertResp.data as { id: string; public_tracking_token: string }

  // 9. Envoi email de vérification
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (request.headers.get('origin') ?? 'https://kovas.fr')

  try {
    await sendVerificationEmail(admin, {
      quoteRequestId: inserted.id,
      trackingToken: inserted.public_tracking_token,
      email: requesterEmail,
      firstName: payload.requester_first_name,
      code: verificationCode,
      baseUrl,
    })
  } catch (err) {
    console.error('[quote-request] send verification email failed', err)
    // On laisse passer : l'utilisateur peut demander un renvoi via /resend-code.
  }

  // 10. Record rate limits (toutes les clés en parallèle)
  const keys = [
    clientIp ? ipKey(clientIp) : null,
    emailKey(requesterEmail),
    emailDiagKey(requesterEmail, diag.id),
  ].filter((k): k is string => k !== null)

  await recordRateLimitHit(admin, keys)

  return NextResponse.json({
    trackingToken: inserted.public_tracking_token,
    requestId: inserted.id,
    message:
      'Vérifiez votre email pour confirmer votre demande. Un code à 6 chiffres vous a été envoyé.',
  })
}
