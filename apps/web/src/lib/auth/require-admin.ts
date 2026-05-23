import { getCurrentUser } from '@/lib/auth/current-user'
import { redirect } from 'next/navigation'

/**
 * Liste des emails admin KOVAS (founders + advisor diagnostiqueur futur).
 *
 * Source de vérité V1 :
 * - contact@kovas.fr         (founder, mailbox officielle unique du site)
 * - benjamin@kovas.fr        (founder, alias historique conservé pour ne pas
 *                            casser l'auth si la mailbox role-based n'est pas
 *                            encore migrée vers `contact@`)
 * - benjaminbel@outlook.fr   (founder personal)
 *
 * V1.1+ : migration vers colonne `profiles.is_admin boolean` (cf. docs/SECURITY.md
 * § "Procédure d'élévation admin"). En attendant l'on garde une allowlist
 * statique pour limiter la surface d'attaque (impossibilité d'élévation via SQL
 * injection sur la table profiles).
 */
const ADMIN_EMAIL_ALLOWLIST: ReadonlySet<string> = new Set([
  'contact@kovas.fr',
  'benjamin@kovas.fr',
  'benjaminbel@outlook.fr',
])

/**
 * Liste env-overridable (NEXT_PUBLIC_ADMIN_EMAILS="a@x.fr,b@y.fr").
 * Lue à l'exécution server-side uniquement (jamais bundlée client).
 */
function getEnvAdminEmails(): ReadonlySet<string> {
  const raw = process.env.KOVAS_ADMIN_EMAILS ?? ''
  if (!raw) return new Set()
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  )
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
  const envAdmins = getEnvAdminEmails()
  const isAdmin = ADMIN_EMAIL_ALLOWLIST.has(email) || envAdmins.has(email)

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
    const envAdmins = getEnvAdminEmails()
    const isAdmin = ADMIN_EMAIL_ALLOWLIST.has(email) || envAdmins.has(email)
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
