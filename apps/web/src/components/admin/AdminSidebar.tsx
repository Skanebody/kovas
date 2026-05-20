'use client'

import { adminLogoutAction } from '@/app/admin/actions'
import type { AdminRole } from '@/lib/admin/admin-middleware'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  BarChart3,
  Bot,
  DollarSign,
  Home,
  LogOut,
  ScrollText,
  Settings,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface AdminSidebarProps {
  role: AdminRole
}

interface NavItem {
  label: string
  icon: typeof Home
  href: string
  enabled: boolean
}

// 10 sections — activées progressivement (Aujourd'hui, Croissance, Finance, Utilisateurs).
const NAV_ITEMS: NavItem[] = [
  { label: "Aujourd'hui", icon: Home, href: '/admin', enabled: true },
  { label: 'Croissance', icon: TrendingUp, href: '/admin/croissance', enabled: true },
  { label: 'Finance', icon: DollarSign, href: '/admin/finance', enabled: true },
  { label: 'Utilisateurs', icon: Users, href: '/admin/users', enabled: true },
  { label: 'Coûts IA', icon: Bot, href: '/admin/cout-ia', enabled: true },
  { label: 'Produit', icon: BarChart3, href: '/admin/produit', enabled: true },
  { label: 'Alertes', icon: AlertTriangle, href: '/admin/alertes', enabled: true },
  { label: 'Paliers', icon: Target, href: '/admin/paliers', enabled: true },
  { label: 'Actions', icon: Settings, href: '/admin/actions', enabled: true },
  { label: 'Audit', icon: ScrollText, href: '/admin/audit', enabled: true },
]

export function AdminSidebar({ role }: AdminSidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className="hidden md:flex w-60 flex-col bg-sidebar-bg text-paper/90 border-r border-black/40"
      aria-label="Navigation admin"
    >
      {/* Logo + badge ADMIN */}
      <div className="px-5 py-5 border-b border-white/5 flex items-center gap-2.5">
        <div className="size-7 rounded-md bg-chartreuse" aria-hidden />
        <div className="flex flex-col leading-tight">
          <span className="font-display text-[15px] font-semibold tracking-tight text-paper">
            KOVAS
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-danger">
            Admin · {role.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Items */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/admin' && pathname.startsWith(`${item.href}/`))
          const Icon = item.icon

          if (!item.enabled) {
            return (
              <span
                key={item.href}
                title="À venir dans une prochaine itération"
                aria-disabled="true"
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-[13px]',
                  'opacity-40 cursor-not-allowed select-none',
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{item.label}</span>
                <span className="font-mono text-[9px] uppercase tracking-wider text-paper/40">
                  bientôt
                </span>
              </span>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors',
                isActive
                  ? 'bg-chartreuse text-ink font-semibold'
                  : 'text-paper/80 hover:bg-white/5 hover:text-paper',
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/5 px-3 py-4 space-y-2">
        <div className="flex items-center justify-between px-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-danger">
            ● Admin actif
          </span>
        </div>
        <form action={adminLogoutAction}>
          <button
            type="submit"
            className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-[12px] text-paper/70 hover:bg-white/5 hover:text-paper transition-colors"
          >
            <LogOut className="size-4" aria-hidden />
            Déconnexion
          </button>
        </form>
      </div>
    </aside>
  )
}
