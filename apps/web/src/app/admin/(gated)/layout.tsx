import { AdminHeader } from '@/components/admin/AdminHeader'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { TwoFaSlidingRefresh } from '@/components/admin/TwoFaSlidingRefresh'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * Layout des pages admin protégées (route group `(gated)`).
 *
 * Gate : auth + admin actif + (si la 2FA est VOLONTAIREMENT activée) cookie
 * 2FA validé.
 *
 * 2FA OPTIONNELLE (refonte 2026-05-31) : on ne force PLUS la configuration de
 * la 2FA à la première connexion. Un admin sans 2FA activée entre directement.
 * La 2FA reste fortement recommandée et s'active/désactive depuis les réglages
 * (/dashboard/account onglet Sécurité) ou via /admin/setup-2fa.
 *
 * SÉCURITÉ : pour un admin qui A activé sa 2FA (secret `enabled=true` →
 * `hasNoSecret=false`), la vérification reste OBLIGATOIRE. Si son cookie 2FA
 * est absent/expiré (`needs2FA=true`), il est renvoyé vers /admin/verify-2fa.
 *
 * Les pages /admin/setup-2fa et /admin/verify-2fa sont DELIBEREMENT hors du
 * groupe (gated) pour ne pas créer de boucle de redirect (un user qui
 * needs2FA serait sinon renvoyé vers /admin/verify-2fa par ce même layout
 * lui-même → boucle).
 */
export default async function AdminGatedLayout({ children }: { children: ReactNode }) {
  const access = await verifyAdminAccess()

  // 1. Pas authentifié ou pas admin → 404-équivalent (redirect home publique).
  //    On n'expose pas l'existence de /admin aux non-admins.
  if (!access.isAdmin || !access.user || !access.role) {
    redirect('/')
  }

  // 2. 2FA OPTIONNELLE : on n'exige la vérification que si l'admin a
  //    VOLONTAIREMENT activé sa 2FA (secret enabled=true → hasNoSecret=false)
  //    ET que son cookie 2FA est absent/expiré. Un admin sans 2FA activée
  //    (hasNoSecret=true) entre directement, sans setup forcé.
  if (!access.hasNoSecret && access.needs2FA) {
    redirect('/admin/verify-2fa')
  }

  return (
    <div className="min-h-dvh flex bg-sage">
      {/* Sliding window 2FA : repousse la fenêtre de 72 h à chaque navigation,
          uniquement pour les admins ayant une 2FA active (cookie déjà validé,
          puisque needs2FA=false ici sinon on aurait redirigé). */}
      {!access.hasNoSecret && <TwoFaSlidingRefresh />}
      <AdminSidebar role={access.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader email={access.user.email} role={access.role} />
        {/* AdminAlertBanner — placeholder itération 2 (alertes critiques bandeau rouge) */}
        <main className="flex-1 overflow-y-auto min-w-0 px-4 py-5 md:px-6 md:py-7">{children}</main>
      </div>
    </div>
  )
}
