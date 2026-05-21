/**
 * KOVAS — Renvoi du code de vérification (K1).
 *
 * POST /api/quote-requests/resend-code
 * Body : { trackingToken: string }
 *
 * Rate-limit : 1 renvoi / minute, max 5 renvois / heure par token.
 * (Sécurité contre spam des codes — utilise rate_limits avec clé spéciale.)
 */

import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import {
  regenerateVerificationCode,
  sendVerificationEmail,
} from '@/lib/anti-spam/email-verification'
import { checkRateLimit, recordRateLimitHit } from '@/lib/anti-spam/rate-limits'

export const runtime = 'nodejs'
export const maxDuration = 15

const bodySchema = z.object({
  trackingToken: z.string().min(16).max(64),
})

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
  }

  const { trackingToken } = parsed.data

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // Récupère la demande
  // biome-ignore lint/suspicious/noExplicitAny: dynamic table
  const { data: qrRow, error: qrErr } = await (admin as any)
    .from('quote_requests')
    .select(
      'id, public_tracking_token, requester_email, requester_first_name, requester_email_verified, status',
    )
    .eq('public_tracking_token', trackingToken)
    .maybeSingle()

  if (qrErr || !qrRow) {
    return NextResponse.json({ error: 'Demande introuvable.' }, { status: 404 })
  }

  const row = qrRow as {
    id: string
    public_tracking_token: string
    requester_email: string
    requester_first_name: string
    requester_email_verified: boolean | null
    status: string
  }

  if (row.requester_email_verified === true) {
    return NextResponse.json({
      message: 'Cette demande a déjà été confirmée.',
      alreadyVerified: true,
    })
  }

  // Rate-limit clés spéciales
  const minuteKey = `resend_code_min:${trackingToken}`
  const hourKey = `resend_code_hour:${trackingToken}`

  const minuteVerdict = await checkRateLimit(admin, minuteKey, 1, 1)
  if (!minuteVerdict.allowed) {
    return NextResponse.json(
      { error: 'Patientez quelques instants avant de redemander un code.' },
      { status: 429 },
    )
  }
  const hourVerdict = await checkRateLimit(admin, hourKey, 1, 5)
  if (!hourVerdict.allowed) {
    return NextResponse.json(
      { error: 'Trop de demandes de renvoi de code. Réessayez plus tard.' },
      { status: 429 },
    )
  }

  // Régénère + envoie
  const { code } = await regenerateVerificationCode(admin, row.id)

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (request.headers.get('origin') ?? 'https://kovas.fr')

  try {
    await sendVerificationEmail(admin, {
      quoteRequestId: row.id,
      trackingToken: row.public_tracking_token,
      email: row.requester_email,
      firstName: row.requester_first_name,
      code,
      baseUrl,
    })
  } catch (err) {
    console.error('[resend-code] send failed', err)
    return NextResponse.json(
      { error: 'Erreur lors de l’envoi de l’email. Réessayez dans quelques minutes.' },
      { status: 500 },
    )
  }

  await recordRateLimitHit(admin, [minuteKey, hourKey])

  return NextResponse.json({
    message: 'Un nouveau code vous a été envoyé.',
  })
}
