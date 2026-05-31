import type { AdminRole } from '@/lib/admin/admin-middleware'
import { Lock } from 'lucide-react'
import { AdminMobileNavTrigger } from './AdminSidebar'

interface AdminHeaderProps {
  email: string
  role: AdminRole
}

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super admin',
  admin: 'Admin',
  support: 'Support',
}

export function AdminHeader({ email, role }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-rule/60 bg-sage/85 backdrop-blur-md">
      <div className="px-4 md:px-6 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {/* Hamburger → drawer nav admin (mobile uniquement) */}
          <AdminMobileNavTrigger role={role} />
          <nav className="text-[12px] text-ink-mute min-w-0" aria-label="Fil d'Ariane">
            <ol className="flex items-center gap-1.5">
              {/* Segments amont masqués sous sm pour laisser la place au libellé courant */}
              <li className="hidden sm:list-item">KOVAS</li>
              <li aria-hidden className="hidden sm:list-item text-ink-faint">
                /
              </li>
              <li className="hidden sm:list-item">Admin</li>
              <li aria-hidden className="hidden sm:list-item text-ink-faint">
                /
              </li>
              <li className="text-ink font-medium truncate">Aujourd'hui</li>
            </ol>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span
            className="inline-flex items-center gap-1.5 rounded-pill bg-success/15 text-success px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider"
            title="2FA validé"
          >
            <Lock className="size-3" aria-hidden />
            2FA OK
          </span>
          {/* Identité user masquée sur très petit écran (secondaire) */}
          <div className="text-right leading-tight hidden sm:block min-w-0">
            <p className="text-[12px] text-ink font-medium truncate">{email}</p>
            <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
              {ROLE_LABELS[role]}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
