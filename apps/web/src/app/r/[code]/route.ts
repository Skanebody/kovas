import { createHash } from 'node:crypto'
import { isValidReferralCodeFormat, normalizeReferralCode } from '@/lib/referral/code-generator'
import { createClient } from '@/lib/supabase/server'
import { cookies, headers } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Route /r/[code] — URL courte traçable pour les liens affiliés parrainage.
 *
 * Comportement :
 *   1. Valide le format du code (KOV-XXXXX). Sinon → redirige vers /signup propre.
 *   2. Vérifie via RPC `lookup_referral_code` que le code existe + actif.
 *   3. Pose un cookie httpOnly `kovas_ref_code` (90j) qui sera consommé au signup.
 *   4. Logue le clic dans `referral_clicks` (RPC `log_referral_click`) avec
 *      IP hashée SHA-256, user-agent, referer, canal présumé.
 *   5. Redirige (302) vers `/signup?ref=KOV-XXXXX` qui pré-remplit le badge
 *      "Parrainé par X".
 *
 * Conforme RGPD : aucune IP brute stockée. Le hash est non-réversible et
 * sert uniquement à dédoublonner les clics (rate-limit côté analytics).
 */

const REFERRAL_COOKIE = 'kovas_ref_code'
const REFERRAL_COOKIE_MAX_AGE_S = 90 * 24 * 60 * 60 // 90 jours

interface RouteContext {
  params: Promise<{ code: string }>
}

export async function GET(request: Request, context: RouteContext) {
  const { code: rawCode } = await context.params
  const origin = new URL(request.url).origin

  // 1. Format basique
  if (!isValidReferralCodeFormat(rawCode)) {
    return NextResponse.redirect(`${origin}/signup`, { status: 307 })
  }
  const normalized = normalizeReferralCode(rawCode)

  // 2. Lookup serveur (RPC SECURITY DEFINER — ne casse pas la RLS owner-only)
  const supabase = await createClient()
  // Types Database à régénérer post-migration 20260524210000 (lookup_referral_code + log_referral_click)
  // biome-ignore lint/suspicious/noExplicitAny: types Database à régénérer
  const rpc = supabase as any
  const { data: lookup } = await rpc.rpc('lookup_referral_code', {
    p_code: normalized,
  })

  const row = (lookup as { referrer_id: string; active: boolean }[] | null)?.[0]

  if (!row || !row.active) {
    // Code inconnu/désactivé → on continue vers /signup propre (sans badge)
    return NextResponse.redirect(`${origin}/signup`, { status: 307 })
  }

  // 3. Cookie httpOnly 90j
  const cookieStore = await cookies()
  cookieStore.set(REFERRAL_COOKIE, normalized, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: REFERRAL_COOKIE_MAX_AGE_S,
    path: '/',
  })

  // 4. Log click (best-effort, jamais bloquant)
  try {
    const hdrs = await headers()
    const forwardedFor = hdrs.get('x-forwarded-for') ?? ''
    const realIp = hdrs.get('x-real-ip') ?? ''
    const rawIp = (forwardedFor.split(',')[0] ?? realIp ?? 'unknown').trim() || 'unknown'
    // Salt simple (constante côté serveur) + IP → hash 64 hex
    const salt = process.env.REFERRAL_IP_SALT ?? 'kovas-referral-v1'
    const ipHash = createHash('sha256').update(`${salt}:${rawIp}`).digest('hex')

    const userAgent = hdrs.get('user-agent')?.slice(0, 500) ?? null
    const referer = hdrs.get('referer')?.slice(0, 500) ?? null

    const url = new URL(request.url)
    const channel = detectChannel(url.searchParams.get('c'), referer)

    await rpc.rpc('log_referral_click', {
      p_code: normalized,
      p_ip_hash: ipHash,
      p_user_agent: userAgent,
      p_referer: referer,
      p_channel: channel,
    })
  } catch {
    // best-effort : on n'interrompt pas le funnel pour un échec de tracking
  }

  // 5. Redirection vers /signup avec param
  return NextResponse.redirect(`${origin}/signup?ref=${normalized}`, {
    status: 302,
  })
}

function detectChannel(explicit: string | null, referer: string | null): string | null {
  const allowed = ['whatsapp', 'linkedin', 'sms', 'email', 'qr', 'direct']
  if (explicit && allowed.includes(explicit.toLowerCase())) {
    return explicit.toLowerCase()
  }
  if (!referer) return 'direct'
  if (referer.includes('whatsapp')) return 'whatsapp'
  if (referer.includes('linkedin')) return 'linkedin'
  if (referer.includes('mail.')) return 'email'
  return null
}
