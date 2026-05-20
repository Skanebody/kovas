/**
 * POST /api/admin/2fa/setup
 *
 * Body : { secret: string (base32), token: string (6 chiffres) }
 *
 * 1. Auth + admin check (sans gate 2FA — sinon impossible de configurer 2FA la 1re fois)
 * 2. Vérifie que l'admin n'a pas déjà un secret enabled (idempotence)
 * 3. verifyTotp(secret, token) — vérifie que le user a bien scanné et possède l'app
 * 4. encrypt + UPSERT admin_2fa_secrets enabled=true, enabled_at=now()
 * 5. Pose le cookie HMAC immédiat (user déjà 2FA-validé puisqu'il vient de prouver
 *    qu'il a l'app)
 * 6. Audit log `2fa_enabled`
 *
 * Si token invalide → 400 et secret jamais persisté → user doit retenter (ou
 * recharger la page pour générer un nouveau secret).
 */

import { TWO_FA_COOKIE_NAME, TWO_FA_COOKIE_TTL_MS, signTwoFaCookie } from '@/lib/admin/2fa-cookie'
import { logAdminAction } from '@/lib/admin/audit-log'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { verifyTotp } from '@/lib/admin/totp'
import { encryptSecret } from '@/lib/admin/totp-crypto'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

interface SetupBody {
  secret?: unknown
  token?: unknown
}

interface AdminUserRow {
  role: 'super_admin' | 'admin' | 'support'
  is_active: boolean
}

interface ExistingSecretRow {
  enabled: boolean
}

export async function POST(request: Request) {
  // 1. Parse body
  let body: SetupBody
  try {
    body = (await request.json()) as SetupBody
  } catch {
    return NextResponse.json({ ok: false, error: 'Body JSON invalide.' }, { status: 400 })
  }

  const secret = typeof body.secret === 'string' ? body.secret.trim() : ''
  const token = typeof body.token === 'string' ? body.token.trim() : ''

  // base32 : minimum 16 chars (80 bits), max raisonnable 64. On accepte alphabet RFC 4648.
  if (!/^[A-Z2-7]{16,64}$/.test(secret)) {
    return NextResponse.json({ ok: false, error: 'Secret base32 invalide.' }, { status: 400 })
  }
  if (!/^\d{6}$/.test(token)) {
    return NextResponse.json(
      { ok: false, error: 'Code 2FA invalide (6 chiffres attendus).' },
      { status: 400 },
    )
  }

  // 2. Auth
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Non authentifié.' }, { status: 401 })
  }

  // 3. Admin actif ?
  const { data: admin } = await supabase
    .from('admin_users')
    .select('role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle<AdminUserRow>()

  if (!admin) {
    return NextResponse.json({ ok: false, error: 'Accès refusé.' }, { status: 403 })
  }

  // 4. IP / UA pour audit
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  const userAgent = request.headers.get('user-agent') ?? null

  // 5. Service-role pour write des tables sensibles
  const adminDb = createAdminClient()

  // 6. Idempotence : déjà un secret enabled ? → 409 (l'opérateur doit supprimer manuellement)
  const { data: existing } = await (
    adminDb.from('admin_2fa_secrets') as unknown as {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{ data: ExistingSecretRow | null }>
        }
      }
    }
  )
    .select('enabled')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing?.enabled) {
    return NextResponse.json(
      {
        ok: false,
        error: '2FA déjà configuré. Pour réinitialiser, contactez un super_admin.',
      },
      { status: 409 },
    )
  }

  // 7. Vérifie le TOTP avec le secret fourni (PAS encore en BDD).
  let valid = false
  try {
    valid = verifyTotp(secret, token, 1)
  } catch (error) {
    console.error('[admin/2fa/setup] verifyTotp failed', error)
    valid = false
  }

  if (!valid) {
    // Log de la tentative mais SANS persister le secret.
    await logAdminAction({
      adminUserId: user.id,
      actionType: '2fa_setup_failed',
      actionSource: 'dashboard_web',
      ipAddress,
      userAgent,
      succeeded: false,
      errorMessage: 'TOTP code mismatch on setup',
    })
    return NextResponse.json(
      { ok: false, error: "Code invalide. Vérifiez l'horloge de votre téléphone et réessayez." },
      { status: 400 },
    )
  }

  // 8. Chiffre + UPSERT (succès garanti par RLS service_role).
  let encrypted: string
  try {
    encrypted = encryptSecret(secret)
  } catch (error) {
    console.error('[admin/2fa/setup] encrypt failed', error)
    return NextResponse.json({ ok: false, error: 'Erreur serveur (chiffrement).' }, { status: 500 })
  }

  const nowIso = new Date().toISOString()
  const { error: upsertError } = await (
    adminDb.from('admin_2fa_secrets') as unknown as {
      upsert: (row: {
        user_id: string
        secret_encrypted: string
        enabled: boolean
        enabled_at: string
        last_used_at: string
      }) => Promise<{ error: { message: string } | null }>
    }
  ).upsert({
    user_id: user.id,
    secret_encrypted: encrypted,
    enabled: true,
    enabled_at: nowIso,
    last_used_at: nowIso,
  })

  if (upsertError) {
    console.error('[admin/2fa/setup] upsert failed', upsertError)
    return NextResponse.json({ ok: false, error: 'Erreur serveur (persistence).' }, { status: 500 })
  }

  // 9. Cookie 2FA validé immédiat (le user vient de prouver qu'il a l'app).
  const cookieStore = await cookies()
  cookieStore.set(TWO_FA_COOKIE_NAME, signTwoFaCookie(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: Math.floor(TWO_FA_COOKIE_TTL_MS / 1000),
  })

  // 10. Audit
  await logAdminAction({
    adminUserId: user.id,
    actionType: '2fa_enabled',
    actionSource: 'dashboard_web',
    ipAddress,
    userAgent,
    succeeded: true,
  })

  return NextResponse.json({ ok: true, redirect: '/admin' })
}
