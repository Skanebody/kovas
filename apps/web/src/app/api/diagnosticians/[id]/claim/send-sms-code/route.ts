import { buildClaimSmsVerification } from '@/lib/diagnosticians/claim-templates'
import { isFrenchMobile, maskPhone } from '@/lib/diagnosticians/mask-contact'
import { checkClaimRateLimit, extractIpFromRequest } from '@/lib/diagnosticians/rate-limit'
import { sendSms } from '@/lib/diagnosticians/sms-brevo'
import {
  computeCodeExpiresAt,
  generateVerificationCode,
} from '@/lib/diagnosticians/verification-code'
import { checkRateLimit } from '@/lib/rate-limit'
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

  // Defense-in-depth : rate-limit Upstash global anti-OTP-spam SMS
  // (coût Brevo SMS critique + brute-force code). 3 demandes / 15 min / IP.
  const upstashRl = await checkRateLimit('auth_strict', `claim_sms:${ip ?? 'unknown'}`)
  if (!upstashRl.success) {
    const retryAfter = Math.max(0, Math.ceil((upstashRl.reset - Date.now()) / 1000))
    return NextResponse.json(
      { error: 'Trop de demandes. Réessayez dans quelques minutes.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

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

  // Refonte Doctolib 2026-05-27 : si un claimId v2 (siret_verified) est passé
  // par le client, on update la claim existante au lieu d'en créer une nouvelle.
  // Ainsi on garde 1 seule claim pour les 3 étapes séquentielles.
  let existingClaimId: string | null = null
  try {
    const reqBody = (await request
      .clone()
      .json()
      .catch(() => null)) as { claimId?: string } | null
    if (
      reqBody?.claimId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(reqBody.claimId)
    ) {
      existingClaimId = reqBody.claimId
    }
  } catch {
    // pas de body / pas JSON — comportement v1 (création nouvelle claim)
  }

  let claim: { id: string } | null = null

  if (existingClaimId) {
    const { data: existing, error: existingErr } = await adminAny
      .from('claim_requests')
      .select('id, diagnostician_id, status, flow_version, siret_verified_at')
      .eq('id', existingClaimId)
      .maybeSingle()

    if (existingErr || !existing || existing.diagnostician_id !== diagnosticianId) {
      return NextResponse.json({ error: 'Claim introuvable ou non lié.' }, { status: 404 })
    }
    if (!existing.siret_verified_at) {
      return NextResponse.json({ error: 'Étape SIRET requise avant le SMS.' }, { status: 409 })
    }

    const { data: updated, error: updErr } = await adminAny
      .from('claim_requests')
      .update({
        method: 'sms_official',
        status: 'code_sent',
        verification_code: code,
        verification_code_expires_at: expiresAt.toISOString(),
        verification_attempts: 0,
        contact_phone: diag.phone,
        flow_version: 'v2_doctolib',
        ip_address: ip,
        user_agent: userAgent,
      })
      .eq('id', existingClaimId)
      .select('id')
      .single()

    if (updErr || !updated) {
      return NextResponse.json(
        { error: 'Impossible de mettre à jour la demande.' },
        { status: 500 },
      )
    }
    claim = { id: updated.id }
  } else {
    const { data: inserted, error: insertErr } = await adminAny
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

    if (insertErr || !inserted) {
      return NextResponse.json({ error: 'Impossible de créer la demande.' }, { status: 500 })
    }
    claim = { id: inserted.id }
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
