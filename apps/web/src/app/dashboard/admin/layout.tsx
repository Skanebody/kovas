import { requireAdmin } from '@/lib/auth/require-admin'
import type { ReactNode } from 'react'

export const metadata = {
  title: 'Admin · KOVAS',
  robots: { index: false, follow: false },
}

/**
 * Layout admin — protège TOUS les sous-routes `/app/dashboard/admin/**`
 * via `requireAdmin()` server-side. Aucun rendu si non admin (redirect).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  // Garde server-side : redirect '/app/dashboard' si non admin.
  await requireAdmin()

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[#0F1419]/[0.08] bg-paper px-4 py-2 text-[11px] font-mono uppercase tracking-[0.1em] text-[#0F1419]/72">
        Zone admin · Accès restreint
      </div>
      {children}
    </div>
  )
}
