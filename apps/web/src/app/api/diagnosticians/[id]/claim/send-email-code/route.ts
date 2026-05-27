import { buildClaimEmailVerification } from '@/lib/diagnosticians/claim-templates'
import { maskEmail } from '@/lib/diagnosticians/mask-contact'
import { checkClaimRateLimit, extractIpFromRequest } from '@/lib/diagnosticians/rate-limit'
import {
  computeCodeExpiresAt,
  generateVerificationCode,
} from '@/lib/diagnosticians/verification-code'
import { sendEmail } from '@/lib/email/send'
import { checkRateLimit } from '@/lib/rate-limit'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * POST /api/diagnosticians/[id]/claim/send-email-code
 *
 * Public (anon). Génère un code 6 chiffres et l'envoie par email à l'adresse
 * officielle stockée sur la fiche diagnostician (jamais saisie côté client).
 *
 * Rate-limit : 5 demandes/h/IP, 10/h/diag.
 */
export const runtime = 'nodejs'
export const maxDuration = 30

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kovas.fr'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: diagnosticianId } = await params

  // Validation UUID (anti-injection)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(diagnosticianId)) {
    return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
  }

  const ip = extractIpFromRequest(request)
  const userAgent = request.headers.get('user-agent')?.slice(0, 300) ?? null

  // Defense-in-depth : rate-limit Upstash global anti-OTP-spam (coût Brevo +
  // brute-force code). 3 demandes / 15 min / IP. Fail-closed en prod si Upstash absent.
  const upstashRl = await checkRateLimit('auth_strict', `claim_email:${ip ?? 'unknown'}`)
  if (!upstashRl.success) {
    const retryAfter = Math.max(0, Math.ceil((upstashRl.reset - Date.now()) / 1000))
    return NextResponse.json(
      { error: 'Trop de demandes. Réessayez dans quelques minutes.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } },
    )
  }

  // Rate-limit anti-abus DB-based (par IP + par diag cible)
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

  // Charge le diag — vérifie qu'il existe + est unclaimed
  // FIX-FF (mai 2026) : colonnes consolidées (full_name/email au lieu de display_name/official_email)
  const { data: diag, error: diagErr } = await adminAny
    .from('diagnosticians')
    .select('id, full_name, first_name, last_name, email, claim_status')
    .eq('id', diagnosticianId)
    .maybeSingle()

  if (diagErr || !diag) {
    return NextResponse.json({ error: 'Fiche introuvable' }, { status: 404 })
  }
  if (diag.claim_status !== 'unclaimed') {
    return NextResponse.json({ error: 'Cette fiche a déjà été réclamée.' }, { status: 409 })
  }
  if (!diag.email) {
    return NextResponse.json(
      { error: "Pas d'email officiel disponible pour cette fiche." },
      { status: 422 },
    )
  }

  // Génération du code
  const code = generateVerificationCode()
  const expiresAt = computeCodeExpiresAt()

  // Insert claim_requests
  const { data: claim, error: insertErr } = await adminAny
    .from('claim_requests')
    .insert({
      diagnostician_id: diagnosticianId,
      method: 'email_official',
      status: 'code_sent',
      verification_code: code,
      verification_code_expires_at: expiresAt.toISOString(),
      contact_email: diag.email,
      ip_address: ip,
      user_agent: userAgent,
    })
    .select('id')
    .single()

  if (insertErr || !claim) {
    return NextResponse.json({ error: 'Impossible de créer la demande.' }, { status: 500 })
  }

  // Envoi email
  const claimUrl = `${SITE_URL}/reclamer-ma-fiche/${diagnosticianId}?claim=${claim.id}`
  const diagDisplayName =
    diag.full_name?.trim() ||
    `${(diag.first_name ?? '').trim()} ${(diag.last_name ?? '').trim()}`.trim() ||
    'Diagnostiqueur'
  const payload = buildClaimEmailVerification({
    code,
    diagnosticianName: diagDisplayName,
    claimUrl,
  })

  const emailResult = await sendEmail({
    to: diag.email,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    category: 'transactional',
  })

  if (!emailResult.success && !emailResult.stub) {
    // On garde la claim_requests pour audit mais on signale l'échec
    return NextResponse.json(
      { error: "L'envoi de l'email a échoué. Réessayez plus tard." },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    claimId: claim.id,
    maskedEmail: maskEmail(diag.email),
    expiresAt: expiresAt.toISOString(),
  })
}
