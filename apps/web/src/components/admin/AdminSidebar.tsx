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
  CalendarCheck,
  CalendarRange,
  DollarSign,
  Flag,
  Gauge,
  HardDrive,
  HeartPulse,
  Home,
  Inbox,
  LogOut,
  MailCheck,
  Megaphone,
  Menu,
  Newspaper,
  Rocket,
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
import { useState } from 'react'
import { Drawer } from 'vaul'

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
    group: 'Rétention (acqui-target)',
    items: [
      { label: 'Refonte status', icon: Rocket, href: '/admin/refonte', enabled: true },
      { label: 'Renouvellements', icon: CalendarCheck, href: '/admin/renewals', enabled: true },
      { label: 'Churn (A1.3.11)', icon: UserMinus, href: '/admin/churn', enabled: true },
      { label: 'Presse', icon: Megaphone, href: '/admin/press', enabled: true },
    ],
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
      {
        label: 'Anomalies SIRET',
        icon: ShieldCheck,
        href: '/admin/signup-anomalies',
        enabled: true,
      },
    ],
  },
  {
    group: 'Observabilité',
    items: [
      { label: 'Email Health', icon: MailCheck, href: '/admin/email-health', enabled: true },
      { label: 'Santé tech', icon: HeartPulse, href: '/admin/sante-tech', enabled: true },
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

/** Logo + badge ADMIN — partagé sidebar desktop / drawer mobile. */
function AdminSidebarBrand({ role }: { role: AdminRole }) {
  return (
    <div className="px-5 py-5 border-b border-white/5 flex items-center gap-2.5">
      <div className="size-7 rounded-md bg-chartreuse shrink-0" aria-hidden />
      <div className="flex flex-col leading-tight min-w-0">
        <span className="font-display text-[15px] font-semibold tracking-tight text-paper">
          KOVAS
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-danger truncate">
          Admin · {role.replace('_', ' ')}
        </span>
      </div>
    </div>
  )
}

/**
 * Liste de navigation groupée — partagée entre la sidebar desktop et le drawer
 * mobile. `onNavigate` permet au drawer de se fermer au clic sur un lien.
 */
function AdminNavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Liens admin">
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
                    <span className="flex-1 min-w-0 truncate">{item.label}</span>
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
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-[13px] transition-colors',
                    isActive
                      ? 'bg-chartreuse text-ink font-semibold'
                      : 'text-paper/80 hover:bg-white/5 hover:text-paper',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  <span className="flex-1 min-w-0 truncate">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

/** Footer (statut + déconnexion) — partagé sidebar desktop / drawer mobile. */
function AdminSidebarFooter() {
  return (
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
  )
}

/**
 * Sidebar admin desktop — masquée sous `md` (le drawer mobile prend le relais
 * via le hamburger dans `AdminHeader`).
 */
export function AdminSidebar({ role }: AdminSidebarProps) {
  return (
    <aside
      className="hidden md:flex w-60 shrink-0 flex-col bg-sidebar-bg text-paper/90 border-r border-black/40"
      aria-label="Navigation admin"
    >
      <AdminSidebarBrand role={role} />
      <AdminNavList />
      <AdminSidebarFooter />
    </aside>
  )
}

/**
 * Drawer de navigation admin mobile (< md) — réutilise la même liste de nav que
 * la sidebar desktop. Ouvert depuis le hamburger du `AdminHeader` via un état
 * contrôlé. Glisse depuis la gauche (vaul `direction="left"`).
 */
export function AdminMobileNav({
  role,
  open,
  onOpenChange,
}: {
  role: AdminRole
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction="left">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50 md:hidden" />
        <Drawer.Content
          className="fixed inset-y-0 left-0 z-50 flex w-[82vw] max-w-[18rem] flex-col bg-sidebar-bg text-paper/90 outline-none focus:outline-none md:hidden"
          aria-label="Navigation admin"
        >
          <Drawer.Title className="sr-only">Navigation admin</Drawer.Title>
          <Drawer.Description className="sr-only">
            Menu de navigation de l&apos;espace administration KOVAS
          </Drawer.Description>
          <AdminSidebarBrand role={role} />
          <AdminNavList onNavigate={() => onOpenChange(false)} />
          <AdminSidebarFooter />
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

/**
 * Bouton hamburger autonome (état interne) qui ouvre le drawer mobile.
 * Destiné à être placé dans `AdminHeader` (visible `md:hidden`).
 */
export function AdminMobileNavTrigger({ role }: AdminSidebarProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu admin"
        aria-expanded={open}
        className="md:hidden inline-flex size-9 shrink-0 items-center justify-center rounded-md text-ink-mute hover:bg-ink/5 hover:text-ink transition-colors"
      >
        <Menu className="size-5" aria-hidden />
      </button>
      <AdminMobileNav role={role} open={open} onOpenChange={setOpen} />
    </>
  )
}
