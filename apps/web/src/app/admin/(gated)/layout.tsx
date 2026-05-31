import { AdminHeader } from '@/components/admin/AdminHeader'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * Layout des pages admin protégées (route group `(gated)`).
 *
 * Toutes les pages enfants (/, /croissance, /finance, etc.) passent par cette
 * gate : auth + admin actif + secret 2FA configuré + cookie 2FA validé.
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

  // 2. Admin sans secret 2FA configuré → page de setup.
  if (access.hasNoSecret) {
    redirect('/admin/setup-2fa')
  }

  // 3. Admin avec secret mais cookie 2FA absent/expiré → vérification.
  if (access.needs2FA) {
    redirect('/admin/verify-2fa')
  }

  return (
    <div className="min-h-dvh flex bg-sage">
      <AdminSidebar role={access.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader email={access.user.email} role={access.role} />
        {/* AdminAlertBanner — placeholder itération 2 (alertes critiques bandeau rouge) */}
        <main className="flex-1 overflow-y-auto min-w-0 px-4 py-5 md:px-6 md:py-7">{children}</main>
      </div>
    </div>
  )
}
