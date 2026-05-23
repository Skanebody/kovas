'use client'

import { adminLogoutAction } from '@/app/admin/actions'
import type { AdminRole } from '@/lib/admin/admin-middleware'
import { cn } from '@/lib/utils'
import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  Bot,
  CalendarRange,
  DollarSign,
  Flag,
  Gauge,
  HardDrive,
  Home,
  Inbox,
  LogOut,
  MailCheck,
  Newspaper,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Target,
  TrendingUp,
  UserMinus,
  Users,
  Wrench,
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

interface NavGroup {
  /** Label uppercase du groupe — null = pas de séparateur (items inline en début de sidebar). */
  group: string | null
  items: NavItem[]
}

// 19 sections regroupées :
//   - Pilotage     (Aujourd'hui, Croissance, Finance, Scheduling, Utilisateurs, Coûts IA,
//                   Produit, Alertes, Paliers, Actions, Utilities)
//   - Observabilité (Email, Performance, Churn risk, PITR Backups)  ← P1
//   - Conformité    (Stockage, Stripe Health, RGPD, Audit)            ← P0 + Audit
const NAV_GROUPS: NavGroup[] = [
  {
    group: null,
    items: [
      { label: "Aujourd'hui", icon: Home, href: '/admin', enabled: true },
      { label: 'Croissance', icon: TrendingUp, href: '/admin/croissance', enabled: true },
      { label: 'Finance', icon: DollarSign, href: '/admin/finance', enabled: true },
      { label: 'Scheduling', icon: CalendarRange, href: '/admin/scheduling', enabled: true },
      { label: 'Utilisateurs', icon: Users, href: '/admin/users', enabled: true },
      { label: 'Coûts IA', icon: Bot, href: '/admin/cout-ia', enabled: true },
      { label: 'Produit', icon: BarChart3, href: '/admin/produit', enabled: true },
      { label: 'Alertes', icon: AlertTriangle, href: '/admin/alertes', enabled: true },
      { label: 'Paliers', icon: Target, href: '/admin/paliers', enabled: true },
      { label: 'Actions', icon: Settings, href: '/admin/actions', enabled: true },
      { label: 'Utilities', icon: Wrench, href: '/admin/utilities', enabled: true },
    ],
  },
  {
    group: 'Pipeline SEO',
    items: [{ label: 'Kanban drafts', icon: Newspaper, href: '/admin/seo/kanban', enabled: true }],
  },
  {
    group: 'Leads',
    items: [{ label: 'Queue leads', icon: Inbox, href: '/admin/leads/queue', enabled: true }],
  },
  {
    group: 'Vérifications',
    items: [
      {
        label: 'File modération',
        icon: ShieldAlert,
        href: '/admin/verifications/queue',
        enabled: true,
      },
      { label: 'Signalements', icon: Flag, href: '/admin/signalements', enabled: true },
    ],
  },
  {
    group: 'Observabilité',
    items: [
      { label: 'Email Health', icon: MailCheck, href: '/admin/email-health', enabled: true },
      { label: 'Performance', icon: Gauge, href: '/admin/performance', enabled: true },
      { label: 'Churn risk', icon: UserMinus, href: '/admin/churn-risk', enabled: true },
      { label: 'PITR Backups', icon: Archive, href: '/admin/backups', enabled: true },
    ],
  },
  {
    group: 'Conformité',
    items: [
      { label: 'Stockage', icon: HardDrive, href: '/admin/storage', enabled: true },
      { label: 'Stripe Health', icon: Activity, href: '/admin/stripe-health', enabled: true },
      { label: 'RGPD', icon: ShieldCheck, href: '/admin/rgpd', enabled: true },
      { label: 'Audit', icon: ScrollText, href: '/admin/audit', enabled: true },
    ],
  },
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

      {/* Items groupés */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV_GROUPS.map((group, groupIdx) => (
          <div
            key={group.group ?? `group-${groupIdx}`}
            className={cn(groupIdx > 0 ? 'pt-3 mt-3 border-t border-white/5' : '')}
          >
            {group.group ? (
              <p className="px-3 mb-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-paper/40">
                {group.group}
              </p>
            ) : null}
            <div className="space-y-1">
              {group.items.map((item) => {
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
            </div>
          </div>
        ))}
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
