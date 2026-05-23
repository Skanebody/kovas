import { buildClaimSmsVerification } from '@/lib/diagnosticians/claim-templates'
import { isFrenchMobile, maskPhone } from '@/lib/diagnosticians/mask-contact'
import { checkClaimRateLimit, extractIpFromRequest } from '@/lib/diagnosticians/rate-limit'
import { sendSms } from '@/lib/diagnosticians/sms-brevo'
import {
  computeCodeExpiresAt,
  generateVerificationCode,
} from '@/lib/diagnosticians/verification-code'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * POST /api/diagnosticians/[id]/claim/send-sms-code
 *
 * Public (anon). Génère un code 6 chiffres et l'envoie par SMS au numéro
 * mobile officiel stocké sur la fiche.
 *
 * Pré-requis : official_phone doit être un mobile FR (06/07/+336/+337).
 * Rate-limit : 5 demandes/h/IP, 10/h/diag.
 */
export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: diagnosticianId } = await params

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(diagnosticianId)) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
  }

  const ip = extractIpFromRequest(request)
  const userAgent = request.headers.get('user-agent')?.slice(0, 300) ?? null

  const rl = await checkClaimRateLimit({ ipAddress: ip, diagnosticianId })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Trop de demandes. Réessayez dans une heure.' },
      {
        status: 429,
        headers: rl.retryAfterSec ? { 'Retry-After': String(rl.retryAfterSec) } : undefined,
      },
    )
  }

  const admin = createAdminClient<Database>(
    // biome-ignore lint/style/noNonNullAssertion: env vars validees au boot Next.js
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    // biome-ignore lint/style/noNonNullAssertion: env vars validees au boot Next.js
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  // biome-ignore lint/suspicious/noExplicitAny: types regen post-merge A1+A4
  const adminAny = admin as any

  // FIX-FF (mai 2026) : colonnes consolidées (full_name/phone au lieu de display_name/official_phone)
  const { data: diag, error: diagErr } = await adminAny
    .from('diagnosticians')
    .select('id, full_name, first_name, last_name, phone, claim_status')
    .eq('id', diagnosticianId)
    .maybeSingle()

  if (diagErr || !diag) {
    return NextResponse.json({ error: 'Fiche introuvable' }, { status: 404 })
  }
  if (diag.claim_status !== 'unclaimed') {
    return NextResponse.json({ error: 'Cette fiche a déjà été réclamée.' }, { status: 409 })
  }
  if (!diag.phone || !isFrenchMobile(diag.phone)) {
    return NextResponse.json(
      { error: 'Pas de mobile FR disponible pour cette fiche.' },
      { status: 422 },
    )
  }

  const code = generateVerificationCode()
  const expiresAt = computeCodeExpiresAt()

  const { data: claim, error: insertErr } = await adminAny
    .from('claim_requests')
    .insert({
      diagnostician_id: diagnosticianId,
      method: 'sms_official',
      status: 'code_sent',
      verification_code: code,
      verification_code_expires_at: expiresAt.toISOString(),
      contact_phone: diag.phone,
      ip_address: ip,
      user_agent: userAgent,
    })
    .select('id')
    .single()

  if (insertErr || !claim) {
    return NextResponse.json({ error: 'Impossible de créer la demande.' }, { status: 500 })
  }

  const content = buildClaimSmsVerification(code)
  const smsResult = await sendSms({
    recipient: diag.phone,
    content,
    category: 'claim_verification',
  })

  if (!smsResult.success && !smsResult.stub) {
    return NextResponse.json(
      { error: "L'envoi du SMS a échoué. Réessayez plus tard." },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    claimId: claim.id,
    maskedPhone: maskPhone(diag.phone),
    expiresAt: expiresAt.toISOString(),
  })
}
