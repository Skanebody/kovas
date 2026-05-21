/**
 * KOVAS — Mission E3 : soumission finale d'une demande de devis B2C
 *                       après vérification OTP SMS.
 *
 * POST /api/leads/submit
 * Body : { leadDraft: QuoteRequestPayload & { diagnostician_id?: string },
 *          otpId?: string,
 *          phone: '+33...' }
 *
 * Workflow :
 *   1. Validation Zod du brouillon de lead.
 *   2. Vérification que l'OTP est bien validé pour ce phone (DB-side).
 *   3. INSERT quote_requests avec :
 *        - status='pending'  (OTP SMS confirme déjà l'authenticité)
 *        - requester_phone normalisé E.164
 *        - otp_verified_at = now()
 *        - otp_attempts = (héritées de otp_codes.attempts)
 *   4. Trigger dispatchRecipients (5 diag) — équivalent route-lead.
 *
 * Réponse :
 *   200 { ok, leadId, routingStrategy: 'multi_dispatch', recipientCount }
 *   400 { error: 'validation_failed' | 'otp_not_verified' }
 *   500 { error: 'insert_failed' }
 */

import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { dispatchRecipients } from '@/lib/leads/dispatch-recipients'
import { quoteRequestPayloadSchema } from '@/lib/quote-request/schema'

export const runtime = 'nodejs'
export const maxDuration = 30

const submitBodySchema = z.object({
  leadDraft: quoteRequestPayloadSchema.extend({
    diagnostician_id: z.string().uuid().optional().nullable(),
  }),
  otpId: z.string().uuid().optional().nullable(),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{1,14}$/, 'Format E.164 requis.'),
})

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

interface OtpRow {
  id: string
  phone_e164: string
  verified_at: string | null
  attempts: number
  purpose: string
}

async function findVerifiedOtp(
  // biome-ignore lint/suspicious/noExplicitAny: dynamic table not in generated types
  admin: SupabaseClient<any, any, any>,
  phone: string,
  otpId: string | null,
): Promise<OtpRow | null> {
  // biome-ignore lint/suspicious/noExplicitAny: dynamic table
  let query = (admin as any)
    .from('otp_codes')
    .select('id, phone_e164, verified_at, attempts, purpose')
    .eq('phone_e164', phone)
    .not('verified_at', 'is', null)
    // exclut le "lock epoch" (verified_at = 1970-01-01)
    .gt('verified_at', '1970-01-02T00:00:00.000Z')
    .order('verified_at', { ascending: false })
    .limit(1)

  if (otpId) {
    query = query.eq('id', otpId)
  }

  const { data, error } = await query
  if (error || !data || data.length === 0) return null
  return data[0] as OtpRow
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = submitBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { leadDraft, otpId, phone } = parsed.data

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[leads/submit] missing Supabase env vars')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }

  const admin = createAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // 1. Vérifie qu'un OTP a bien été validé pour ce numéro
  const otp = await findVerifiedOtp(admin, phone, otpId ?? null)
  if (!otp) {
    return NextResponse.json(
      {
        error: 'otp_not_verified',
        message:
          'Vérifiez votre numéro de téléphone avant d’envoyer votre demande.',
      },
      { status: 400 },
    )
  }

  // 2. Honeypot silencieux : si rempli, on retourne success mais on n'insère rien.
  const honeypotFilled = (leadDraft.honeypot ?? '').length > 0
  if (honeypotFilled) {
    return NextResponse.json({ ok: true, silent: true })
  }

  const requesterEmail = leadDraft.requester_email.trim().toLowerCase()
  const clientIp = getClientIp(request)
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null
  const verifiedAt = new Date().toISOString()

  // 3. Insert quote_request
  // biome-ignore lint/suspicious/noExplicitAny: dynamic table not in generated types
  const adminAny = admin as any

  // diagnostician_id est requis côté DB — si non fourni, on retourne une erreur lisible.
  const diagnosticianId = leadDraft.diagnostician_id ?? null
  if (!diagnosticianId) {
    return NextResponse.json(
      {
        error: 'validation_failed',
        message: 'diagnostician_id requis (depuis fiche publique).',
      },
      { status: 400 },
    )
  }

  const insertResp = await adminAny
    .from('quote_requests')
    .insert({
      diagnostician_id: diagnosticianId,
      requester_first_name: leadDraft.requester_first_name,
      requester_last_name: leadDraft.requester_last_name,
      requester_email: requesterEmail,
      requester_phone: phone,
      property_type: leadDraft.property_type,
      property_situation: leadDraft.property_situation,
      property_address: leadDraft.property_address ?? null,
      property_postal_code: leadDraft.property_postal_code ?? null,
      property_city: leadDraft.property_city ?? null,
      property_surface_m2: leadDraft.property_surface_m2 ?? null,
      property_year_built: leadDraft.property_year_built ?? null,
      property_geo_lat: leadDraft.property_geo_lat ?? null,
      property_geo_lng: leadDraft.property_geo_lng ?? null,
      diagnostics_requested: leadDraft.diagnostics_requested,
      diagnostics_suggested: leadDraft.diagnostics_suggested ?? null,
      message: leadDraft.message ?? null,
      // OTP SMS validé → status 'pending' directement (court-circuit verif email).
      status: 'pending',
      ip_address: clientIp,
      user_agent: userAgent,
      honeypot_filled: false,
      // OTP SMS = authentification forte → email verification non requise pour le routing.
      requester_email_verified: true,
      otp_verified_at: verifiedAt,
      otp_attempts: otp.attempts,
    })
    .select('id, public_tracking_token')
    .single()

  if (insertResp.error || !insertResp.data) {
    console.error('[leads/submit] insert failed', insertResp.error)
    return NextResponse.json(
      { error: 'insert_failed', message: insertResp.error?.message ?? 'unknown' },
      { status: 500 },
    )
  }

  const inserted = insertResp.data as { id: string; public_tracking_token: string }

  // 4. Lie l'OTP au lead (pour audit) si pas déjà lié
  await adminAny
    .from('otp_codes')
    .update({ lead_id: inserted.id })
    .eq('id', otp.id)
    .is('lead_id', null)

  // 5. Trigger dispatch vers 5 diag (équivalent route-lead).
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (request.headers.get('origin') ?? 'https://kovas.fr')

  let recipientCount = 0
  let routingStrategy: 'multi_dispatch' | 'failed' = 'multi_dispatch'
  try {
    const dispatchResult = await dispatchRecipients(admin, inserted.id, baseUrl)
    recipientCount = dispatchResult.totalRecipients
  } catch (err) {
    console.error('[leads/submit] dispatch failed', err)
    routingStrategy = 'failed'
  }

  return NextResponse.json({
    ok: true,
    leadId: inserted.id,
    trackingToken: inserted.public_tracking_token,
    routingStrategy,
    recipientCount,
  })
}
