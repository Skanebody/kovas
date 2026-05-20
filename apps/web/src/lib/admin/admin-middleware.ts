/**
 * Vérification d'accès admin pour les pages /admin et les routes /api/admin/*.
 *
 * Trois étapes :
 *   1. Auth Supabase (user authentifié)
 *   2. Présence active dans admin_users
 *   3. Cookie 2FA valide (HMAC signé, lié au user_id, TTL 30 min)
 *
 * Réutilise le pattern createClient() de lib/supabase/server.ts (compose, pas
 * remplace, getCurrentUser — getCurrentUser redirige vers /login, ici on veut
 * renvoyer un objet structuré pour que le caller décide quoi faire).
 */

import { TWO_FA_COOKIE_NAME, verifyTwoFaCookie } from '@/lib/admin/2fa-cookie'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { cache } from 'react'

export type AdminRole = 'super_admin' | 'admin' | 'support'

export interface AdminAccessResult {
  isAdmin: boolean
  needs2FA: boolean
  /**
   * true si l'admin n'a pas encore configuré son secret TOTP
   * (table `admin_2fa_secrets` vide ou row avec enabled=false).
   * Le caller doit alors rediriger vers /admin/setup-2fa au lieu de /admin/verify-2fa.
   */
  hasNoSecret: boolean
  user: { id: string; email: string } | null
  role: AdminRole | null
}

interface AdminUserRow {
  role: AdminRole
  is_active: boolean
}

interface TwoFaSecretCheckRow {
  enabled: boolean
}

/**
 * Memoized par requête (React cache) pour éviter plusieurs round-trips
 * quand layout + page + child server components appellent verifyAdminAccess().
 */
export const verifyAdminAccess = cache(async (): Promise<AdminAccessResult> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { isAdmin: false, needs2FA: false, hasNoSecret: false, user: null, role: null }
  }

  // RLS sur admin_users : SELECT autorisé via is_admin(auth.uid()). Pour la
  // toute première requête (user pas encore admin) la policy renverra 0 ligne
  // — c'est attendu (= pas admin).
  // Note : admin_users absent du Database type généré (migration 2026-05-21),
  // on type localement la response.
  const { data, error } = await supabase
    .from('admin_users')
    .select('role, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle<AdminUserRow>()

  if (error || !data) {
    return { isAdmin: false, needs2FA: false, hasNoSecret: false, user: null, role: null }
  }

  // Check si le secret TOTP est déjà configuré (enabled=true).
  // RLS 2fa_secrets_self : un admin lit son propre secret.
  const { data: secretRow } = await supabase
    .from('admin_2fa_secrets')
    .select('enabled')
    .eq('user_id', user.id)
    .maybeSingle<TwoFaSecretCheckRow>()

  const hasNoSecret = !secretRow || !secretRow.enabled

  const cookieStore = await cookies()
  const cookieValue = cookieStore.get(TWO_FA_COOKIE_NAME)?.value
  const cookieValid = verifyTwoFaCookie(cookieValue, user.id)

  return {
    isAdmin: true,
    needs2FA: !cookieValid,
    hasNoSecret,
    user: { id: user.id, email: user.email ?? '' },
    role: data.role,
  }
})
