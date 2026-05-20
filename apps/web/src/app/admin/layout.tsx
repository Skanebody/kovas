import { AdminHeader } from '@/components/admin/AdminHeader'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: {
    default: 'Admin · KOVAS',
    template: '%s · Admin · KOVAS',
  },
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const access = await verifyAdminAccess()

  // 1. Pas authentifié ou pas admin → 404-équivalent (redirect home publique).
  //    On n'expose pas l'existence de /admin aux non-admins.
  if (!access.isAdmin || !access.user || !access.role) {
    redirect('/')
  }

  // 2. Admin mais 2FA non validé → page de vérification.
  if (access.needs2FA) {
    redirect('/admin/verify-2fa')
  }

  return (
    <div className="min-h-dvh flex bg-sage">
      <AdminSidebar role={access.role} />
      <div className="flex-1 flex flex-col min-w-0">
        <AdminHeader email={access.user.email} role={access.role} />
        {/* AdminAlertBanner — placeholder itération 2 (alertes critiques bandeau rouge) */}
        <main className="flex-1 overflow-y-auto px-6 py-7">{children}</main>
      </div>
    </div>
  )
}
