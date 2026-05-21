/**
 * KOVAS — Vérification du code email + déclenchement multi-envoi (K1).
 *
 * POST /api/quote-requests/verify-email
 * Body : { trackingToken: string, code: string }
 *
 * Workflow :
 *   1. Verify code (5 tentatives max, code expire après 30 min)
 *   2. Si valide : update status = 'pending' + email_verified=true
 *   3. Dispatch vers 5 diag (multi-recipient-router)
 *   4. Envoi email récap au requester
 */

import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyCode } from '@/lib/anti-spam/email-verification'
import { dispatchRecipients } from '@/lib/leads/dispatch-recipients'

export const runtime = 'nodejs'
export const maxDuration = 30

const bodySchema = z.object({
  trackingToken: z.string().min(16).max(64),
  code: z.string().trim().regex(/^\d{6}$/, 'Code à 6 chiffres requis'),
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
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { trackingToken, code } = parsed.data

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const result = await verifyCode(admin, trackingToken, code)

  if (result.notFound) {
    return NextResponse.json(
      { error: 'Demande introuvable.' },
      { status: 404 },
    )
  }

  if (result.alreadyVerified) {
    return NextResponse.json({
      verified: true,
      message: 'Votre demande a déjà été confirmée.',
      trackingToken,
    })
  }

  if (result.expired) {
    return NextResponse.json(
      {
        error: 'Code expiré. Demandez un nouveau code par email.',
        expired: true,
      },
      { status: 410 },
    )
  }

  if (!result.valid) {
    return NextResponse.json(
      {
        error: 'Code invalide.',
        attemptsRemaining: result.attemptsRemaining,
      },
      { status: 400 },
    )
  }

  // Code valide → on déclenche le dispatch (best-effort, async-friendly)
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (request.headers.get('origin') ?? 'https://kovas.fr')

  // Récupère l'ID quote_request pour dispatch
  // biome-ignore lint/suspicious/noExplicitAny: dynamic table
  const { data: qrRow } = await (admin as any)
    .from('quote_requests')
    .select('id')
    .eq('public_tracking_token', trackingToken)
    .maybeSingle()

  let dispatchInfo: { totalRecipients: number } | null = null
  if (qrRow && typeof (qrRow as { id?: string }).id === 'string') {
    try {
      const dispatchResult = await dispatchRecipients(
        admin,
        (qrRow as { id: string }).id,
        baseUrl,
      )
      dispatchInfo = { totalRecipients: dispatchResult.totalRecipients }
    } catch (err) {
      console.error('[verify-email] dispatch failed', err)
    }
  }

  return NextResponse.json({
    verified: true,
    trackingToken,
    recipientCount: dispatchInfo?.totalRecipients ?? 0,
    message: dispatchInfo
      ? `Votre demande a été transmise à ${dispatchInfo.totalRecipients} diagnostiqueurs.`
      : 'Votre demande a été confirmée.',
  })
}
