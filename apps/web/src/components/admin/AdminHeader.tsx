import type { AdminRole } from '@/lib/admin/admin-middleware'
import { Lock } from 'lucide-react'

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
      <div className="px-6 h-14 flex items-center justify-between">
        <nav className="text-[12px] text-ink-mute" aria-label="Fil d'Ariane">
          <ol className="flex items-center gap-1.5">
            <li>KOVAS</li>
            <li aria-hidden className="text-ink-faint">
              /
            </li>
            <li>Admin</li>
            <li aria-hidden className="text-ink-faint">
              /
            </li>
            <li className="text-ink font-medium">Aujourd'hui</li>
          </ol>
        </nav>

        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-pill bg-success/15 text-success px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider"
            title="2FA validé"
          >
            <Lock className="size-3" aria-hidden />
            2FA OK
          </span>
          <div className="text-right leading-tight">
            <p className="text-[12px] text-ink font-medium">{email}</p>
            <p className="text-[10px] font-mono uppercase tracking-wider text-ink-faint">
              {ROLE_LABELS[role]}
            </p>
          </div>
        </div>
      </div>
    </header>
  )
}
