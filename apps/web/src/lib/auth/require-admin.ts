import { getCurrentUser } from '@/lib/auth/current-user'
import { redirect } from 'next/navigation'

/**
 * Garde admin KOVAS — allowlist d'emails configurable via env.
 *
 * Source de vérité V1 :
 * - **`ADMIN_EMAILS`** (env, CSV) : liste des emails autorisés à accéder à
 *   l'admin. Lue côté serveur uniquement (jamais bundlée client). Exemple :
 *   `ADMIN_EMAILS="contact@kovas.fr,benjaminbel@outlook.fr"`.
 * - Fallback si `ADMIN_EMAILS` n'est pas définie : `contact@kovas.fr`
 *   uniquement (mailbox officielle unique du site — lot #169 sweep email).
 *
 * Historique (lot #169, 2026-05-23) : suppression des alias `benjamin@kovas.fr`
 * et `hello@/noreply@/support@/...` au profit d'une mailbox unique
 * `contact@kovas.fr`. La précédente allowlist statique en dur a été remplacée
 * par cette liste env-overridable pour gagner en flexibilité opérationnelle
 * (rotation founders, advisor diagnostiqueur futur) sans redeploy.
 *
 * V1.1+ : migration vers colonne `profiles.is_admin boolean` (cf. docs/SECURITY.md
 * § "Procédure d'élévation admin"). En attendant on garde une allowlist env
 * pour limiter la surface d'attaque (impossibilité d'élévation via SQL
 * injection sur la table profiles).
 */
const ADMIN_EMAIL_FALLBACK = 'contact@kovas.fr'

/**
 * Parse la variable `ADMIN_EMAILS` (CSV) en `Set<string>` lowercased.
 * Retourne le singleton fallback `contact@kovas.fr` si la variable est vide
 * ou absente.
 */
function getAdminEmailAllowlist(): ReadonlySet<string> {
  const raw = process.env.ADMIN_EMAILS ?? ''
  const parsed = raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (parsed.length === 0) {
    return new Set([ADMIN_EMAIL_FALLBACK])
  }
  return new Set(parsed)
}

export type AdminContext = {
  userId: string
  email: string
  fullName: string | null
  orgId: string
}

/**
 * Garde server-side pour les pages admin. Redirige vers `/app/dashboard`
 * si l'utilisateur n'est pas admin. Doit être appelée AU TOUT DÉBUT
 * d'un Server Component ou layout admin, avant tout fetch sensible.
 *
 * Usage :
 *   const admin = await requireAdmin()
 *   // … fetch admin metrics
 *
 * @returns le contexte admin (id, email, orgId)
 * @throws redirect Next.js si non admin (jamais retourne dans ce cas)
 */
export async function requireAdmin(): Promise<AdminContext> {
  const { user, profile, orgId } = await getCurrentUser()

  const email = (profile.email ?? user.email ?? '').toLowerCase()
  const allowlist = getAdminEmailAllowlist()
  const isAdmin = allowlist.has(email)

  if (!isAdmin) {
    redirect('/app/dashboard')
  }

  return {
    userId: user.id,
    email,
    fullName: profile.full_name,
    orgId,
  }
}

/**
 * Variante "soft" — retourne `null` au lieu de redirect. Utile pour
 * afficher conditionnellement un lien admin dans la sidebar sans
 * casser le rendu si non-admin.
 */
export async function getAdminContext(): Promise<AdminContext | null> {
  try {
    const { user, profile, orgId } = await getCurrentUser()
    const email = (profile.email ?? user.email ?? '').toLowerCase()
    const allowlist = getAdminEmailAllowlist()
    const isAdmin = allowlist.has(email)
    if (!isAdmin) return null
    return {
      userId: user.id,
      email,
      fullName: profile.full_name,
      orgId,
    }
  } catch {
    return null
  }
}
