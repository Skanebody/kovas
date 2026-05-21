/**
 * KOVAS — Mission E3 : vérification d'un code OTP SMS.
 *
 * POST /api/leads/verify-otp
 * Body : { phone: '+33...', code: '123456', otpId?: string, leadId?: string }
 *
 * Workflow :
 *   1. Validation Zod stricte.
 *   2. Proxy vers Edge Function verify-otp.
 *   3. Retour { ok, verifiedAt, leadId?, attemptsRemaining? }.
 *
 * Codes HTTP propagés :
 *   200 → succès
 *   400 → input invalide
 *   401 → code incorrect ou max_attempts_reached
 *   404 → OTP introuvable ou expiré
 *   500 → erreur serveur
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'
export const maxDuration = 15

const bodySchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{1,14}$/, 'Format E.164 requis.'),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Code à 6 chiffres requis.'),
  otpId: z.string().uuid().optional().nullable(),
  leadId: z.string().uuid().optional().nullable(),
})

interface EdgeOtpVerifyResponse {
  ok: boolean
  verifiedAt?: string
  leadId?: string | null
  error?: string
  message?: string
  attemptsRemaining?: number
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
  const { phone, code, otpId, leadId } = parsed.data

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[leads/verify-otp] missing Supabase env vars')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }

  let edgeResponse: Response
  try {
    edgeResponse = await fetch(`${supabaseUrl}/functions/v1/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        phone,
        code,
        otpId: otpId ?? null,
        leadId: leadId ?? null,
      }),
    })
  } catch (err) {
    console.error('[leads/verify-otp] edge fetch failed', err)
    return NextResponse.json(
      { error: 'verify_failed', message: 'Service temporairement indisponible.' },
      { status: 502 },
    )
  }

  let edgeBody: EdgeOtpVerifyResponse = { ok: false }
  try {
    edgeBody = (await edgeResponse.json()) as EdgeOtpVerifyResponse
  } catch {
    edgeBody = { ok: false, error: 'edge_invalid_response' }
  }

  if (!edgeResponse.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: edgeBody.error ?? 'edge_error',
        message: edgeBody.message ?? 'Erreur lors de la vérification du code.',
        attemptsRemaining: edgeBody.attemptsRemaining,
      },
      { status: edgeResponse.status },
    )
  }

  return NextResponse.json({
    ok: true,
    verifiedAt: edgeBody.verifiedAt,
    leadId: edgeBody.leadId ?? leadId ?? null,
  })
}
