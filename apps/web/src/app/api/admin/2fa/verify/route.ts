/**
 * POST /api/admin/2fa/verify
 *
 * Vérifie un code TOTP pour un admin authentifié et :
 *   1. Insère un row dans admin_2fa_attempts (succès/échec)
 *   2. Si succès → met à jour last_used_at, pose le cookie HMAC, log audit
 *   3. Si échec → renvoie 401 + attempts_remaining
 *
 * Rate limit : 3 tentatives ratées dans les 15 dernières minutes → 429.
 *
 * Body : { token: string } (6 chiffres)
 */

import { TWO_FA_COOKIE_NAME, TWO_FA_COOKIE_TTL_MS, signTwoFaCookie } from '@/lib/admin/2fa-cookie'
import { logAdminAction } from '@/lib/admin/audit-log'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { verifyTotp } from '@/lib/admin/totp'
import { decryptSecret } from '@/lib/admin/totp-crypto'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const RATE_LIMIT_MAX_FAILURES = 3

interface VerifyBody {
  token?: unknown
}

interface AdminUserRow {
  role: 'super_admin' | 'admin' | 'support'
  is_active: boolean
}

interface TwoFaSecretRow {
  secret_encrypted: string
  enabled: boolean
}

interface AttemptRow {
  success: boolean
  created_at: string
}

export async function POST(request: Request) {
  // 1. Parse + valide le body
  let body: VerifyBody
  try {
    body = (await request.json()) as VerifyBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Body JSON invalide.' }, { status: 400 })
  }
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!/^\d{6}$/.test(token)) {
    return NextResponse.json(
      { ok: false, error: 'Code 2FA invalide (6 chiffres attendus).' },
      { status: 400 },
    )
  }

  // 2. Auth user
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Non authentifié.' }, { status: 401 })
  }

  // 3. Vérifie admin_users actif (client user, RLS via is_admin)
  const { data: admin } = await supabase
    .from('admin_users')
    .select('role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle<AdminUserRow>()

  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Accès refusé.' }, { status: 403 })
  }

  // 4. Récupère IP/UA pour journalisation
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  const userAgent = request.headers.get('user-agent') ?? null

  // 5. Service-role pour tables sensibles (2fa_secrets/attempts)
  const adminDb = createAdminClient()

  // 6. Rate limit : >= 3 failures dans les 15 dernières minutes ?
  const sinceIso = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString()
  const { data: recentAttempts } = await (
    adminDb.from('admin_2fa_attempts') as unknown as {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          gte: (
            column: string,
            value: string,
          ) => Promise<{ data: AttemptRow[] | null; error: { message: string } | null }>
        }
      }
    }
  )
    .select('success, created_at')
    .eq('user_id', user.id)
    .gte('created_at', sinceIso)

  const failures = (recentAttempts ?? []).filter((a) => !a.success).length
  if (failures >= RATE_LIMIT_MAX_FAILURES) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Trop de tentatives ratées. Réessayez dans 1 h.',
        retry_after_seconds: 3600,
      },
      { status: 429 },
    )
  }

  // 7. Charge le secret 2FA
  const { data: secretRow } = await (
    adminDb.from('admin_2fa_secrets') as unknown as {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{ data: TwoFaSecretRow | null }>
        }
      }
    }
  )
    .select('secret_encrypted, enabled')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!secretRow || !secretRow.enabled) {
    return NextResponse.json(
      {
        ok: false,
        error: '2FA non configuré. Lancez le script setup CLI.',
      },
      { status: 400 },
    )
  }

  // 8. Déchiffre et vérifie le token
  let valid = false
  try {
    const secret = decryptSecret(secretRow.secret_encrypted)
    valid = verifyTotp(secret, token, 1)
  } catch (error) {
    console.error('[admin/2fa/verify] decrypt failed', error)
    valid = false
  }

  // 9. Journalise la tentative (toujours, succès ou échec)
  await (
    adminDb.from('admin_2fa_attempts') as unknown as {
      insert: (row: {
        user_id: string
        success: boolean
        ip_address: string | null
      }) => Promise<{ error: { message: string } | null }>
    }
  ).insert({
    user_id: user.id,
    success: valid,
    ip_address: ipAddress,
  })

  if (!valid) {
    const attemptsRemaining = Math.max(0, RATE_LIMIT_MAX_FAILURES - failures - 1)
    await logAdminAction({
      adminUserId: user.id,
      actionType: '2fa_verify_failed',
      actionSource: 'dashboard_web',
      ipAddress,
      userAgent,
      succeeded: false,
      errorMessage: 'TOTP code mismatch',
    })
    return NextResponse.json(
      {
        ok: false,
        error: 'Code invalide.',
        attempts_remaining: attemptsRemaining,
      },
      { status: 401 },
    )
  }

  // 10. Succès : update last_used_at + cookie HMAC + audit log
  await (
    adminDb.from('admin_2fa_secrets') as unknown as {
      update: (row: { last_used_at: string }) => {
        eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>
      }
    }
  )
    .update({ last_used_at: new Date().toISOString() })
    .eq('user_id', user.id)

  await (
    adminDb.from('admin_users') as unknown as {
      update: (row: { last_login_at: string }) => {
        eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>
      }
    }
  )
    .update({ last_login_at: new Date().toISOString() })
    .eq('user_id', user.id)

  const cookieStore = await cookies()
  cookieStore.set(TWO_FA_COOKIE_NAME, signTwoFaCookie(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: Math.floor(TWO_FA_COOKIE_TTL_MS / 1000),
  })

  await logAdminAction({
    adminUserId: user.id,
    actionType: '2fa_verified',
    actionSource: 'dashboard_web',
    ipAddress,
    userAgent,
    succeeded: true,
  })

  return NextResponse.json({ ok: true, redirect: '/admin' })
}
