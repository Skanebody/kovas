'use server'

/**
 * Server actions pour la gestion par l'admin de SA PROPRE 2FA depuis les
 * réglages du compte (/dashboard/account onglet Sécurité).
 *
 * Périmètre : 2FA ADMIN uniquement (les utilisateurs diagnostiqueurs normaux
 * n'ont pas de 2FA). La 2FA admin est OPTIONNELLE (refonte 2026-05-31).
 *
 * L'ACTIVATION n'est PAS gérée ici : elle nécessite le setup TOTP complet
 * (scan QR + validation d'un premier code). L'UI redirige vers /admin/setup-2fa.
 * Seule la DÉSACTIVATION est exposée en server action (un clic, pas de TOTP).
 */

import { TWO_FA_COOKIE_NAME } from '@/lib/admin/2fa-cookie'
import { logAdminAction } from '@/lib/admin/audit-log'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { createClient } from '@/lib/supabase/server'
import { cookies, headers } from 'next/headers'

export interface DisableTwoFaResult {
  ok: boolean
  error?: string
}

interface AdminUserRow {
  role: 'super_admin' | 'admin' | 'support'
  is_active: boolean
}

/**
 * Désactive la 2FA admin de l'utilisateur courant.
 *
 * 1. Vérifie que l'utilisateur courant est un admin actif (table admin_users)
 * 2. Passe `admin_2fa_secrets.enabled = false` pour ce user_id (service role)
 * 3. Supprime le cookie de validation 2FA
 * 4. Audit log best-effort
 */
export async function disableAdminTwoFaAction(): Promise<DisableTwoFaResult> {
  // 1. Auth de l'utilisateur courant via le client RLS-scoped.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: 'Non authentifié.' }
  }

  // 2. Vérifie que c'est bien un admin actif.
  const { data: admin } = await supabase
    .from('admin_users')
    .select('role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle<AdminUserRow>()

  if (!admin) {
    return { ok: false, error: 'Accès refusé.' }
  }

  // 3. IP / UA pour l'audit.
  const headerStore = await headers()
  const ipAddress =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerStore.get('x-real-ip') ??
    null
  const userAgent = headerStore.get('user-agent') ?? null

  // 4. Service-role pour écrire la table sensible admin_2fa_secrets.
  //    `admin_2fa_secrets` absent du Database type généré (migration 2026-05-21),
  //    on type localement le builder (pas de `any`).
  const adminDb = createAdminClient()
  const { error: updateError } = await (
    adminDb.from('admin_2fa_secrets') as unknown as {
      update: (row: { enabled: boolean }) => {
        eq: (column: string, value: string) => Promise<{ error: { message: string } | null }>
      }
    }
  )
    .update({ enabled: false })
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[account/actions-2fa] disable update failed', updateError)
    await logAdminAction({
      adminUserId: user.id,
      actionType: '2fa_disabled',
      actionSource: 'dashboard_web',
      ipAddress,
      userAgent,
      succeeded: false,
      errorMessage: updateError.message,
    })
    return { ok: false, error: 'Erreur serveur lors de la désactivation.' }
  }

  // 5. Supprime le cookie 2FA (la session admin n'est plus 2FA-validée).
  const cookieStore = await cookies()
  cookieStore.delete(TWO_FA_COOKIE_NAME)

  // 6. Audit log best-effort.
  await logAdminAction({
    adminUserId: user.id,
    actionType: '2fa_disabled',
    actionSource: 'dashboard_web',
    ipAddress,
    userAgent,
    succeeded: true,
  })

  return { ok: true }
}
