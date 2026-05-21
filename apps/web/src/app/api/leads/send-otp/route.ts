/**
 * KOVAS — Mission E3 : envoi OTP SMS pour vérification B2C devis.
 *
 * POST /api/leads/send-otp
 * Body : { phone: '+33...', purpose?: 'lead_verification' | 'diag_claim' | 'login_passwordless', leadId?: string }
 *
 * Workflow :
 *   1. Validation Zod (phone E.164, purpose, leadId UUID optionnel).
 *   2. Proxy vers Edge Function send-otp-sms (service_role auth).
 *   3. Retour { ok, otpId, expiresAt } sans jamais exposer le code.
 *
 * Note : la route reste publique (anon) — la défense anti-spam principale est :
 *   - Rate-limit DB-side dans l'Edge Function (3 OTP / 10 min / phone).
 *   - Honeypot côté form B2C (rempli → succès silencieux côté form).
 *
 * Idempotent vs migration E1 parallèle.
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 15

const bodySchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{1,14}$/, 'Format E.164 requis (+33...).'),
  purpose: z
    .enum(['lead_verification', 'diag_claim', 'login_passwordless'])
    .default('lead_verification'),
  leadId: z.string().uuid().optional().nullable(),
})

interface EdgeOtpSendResponse {
  ok: boolean
  otpId?: string
  expiresAt?: string
  devCode?: string
  error?: string
  message?: string
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { phone, purpose, leadId } = parsed.data

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[leads/send-otp] missing Supabase env vars')
    return NextResponse.json(
      { error: 'server_misconfigured' },
      { status: 500 },
    )
  }

  // Proxy IP client → Edge Function (pour rate-limit / audit)
  const forwardedFor = request.headers.get('x-forwarded-for') ?? ''
  const userAgent = request.headers.get('user-agent') ?? ''

  let edgeResponse: Response
  try {
    edgeResponse = await fetch(`${supabaseUrl}/functions/v1/send-otp-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        'x-forwarded-for': forwardedFor,
        'user-agent': userAgent,
      },
      body: JSON.stringify({ phone, purpose, leadId: leadId ?? null }),
    })
  } catch (err) {
    console.error('[leads/send-otp] edge fetch failed', err)
    return NextResponse.json(
      { error: 'sms_send_failed', message: 'Service temporairement indisponible.' },
      { status: 502 },
    )
  }

  let edgeBody: EdgeOtpSendResponse = { ok: false }
  try {
    edgeBody = (await edgeResponse.json()) as EdgeOtpSendResponse
  } catch {
    edgeBody = { ok: false, error: 'edge_invalid_response' }
  }

  if (!edgeResponse.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: edgeBody.error ?? 'edge_error',
        message: edgeBody.message ?? 'Erreur lors de l’envoi du code.',
      },
      { status: edgeResponse.status },
    )
  }

  // Ne jamais exposer devCode en production — il n'est présent qu'avec OTP_DEV_MODE=true.
  const isDev = process.env.NODE_ENV !== 'production'
  return NextResponse.json({
    ok: true,
    otpId: edgeBody.otpId,
    expiresAt: edgeBody.expiresAt,
    ...(isDev && edgeBody.devCode ? { devCode: edgeBody.devCode } : {}),
  })
}
