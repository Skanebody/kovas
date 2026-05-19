'use client'

import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'
import {
  Building2,
  CalendarDays,
  ChartLine,
  CreditCard,
  FileText,
  Home,
  MessagesSquare,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Section dans la sidebar : nav principale ou "Activité" séparée. */
  section: 'main' | 'activity'
  /** Badge optionnel (count non lus, alertes). */
  badge?: number
}

/**
 * Sitemap canonique v4 (cf. docs/design/KOVAS_UIUX_App_Complete_v4.md §3).
 * Section "main" : navigation produit primaire.
 * Section "activity" : surfaces qui changent souvent (planning, facturation, messages).
 *
 * Les pages /performance, /messages, /biens, /facturation sont prévues V1.5 —
 * affichées dans la sidebar mais peuvent rediriger temporairement.
 */
const NAV: readonly NavItem[] = [
  { href: '/app/dashboard', label: "Aujourd'hui", icon: Home, section: 'main' },
  { href: '/app/dossiers', label: 'Dossiers', icon: FileText, section: 'main' },
  { href: '/app/clients', label: 'Clients', icon: Users, section: 'main' },
  { href: '/app/properties', label: 'Biens', icon: Building2, section: 'main' },
  { href: '/app/calendar', label: 'Planning', icon: CalendarDays, section: 'activity' },
  { href: '/app/gain', label: 'Performance', icon: ChartLine, section: 'activity' },
  { href: '/app/facturation', label: 'Facturation', icon: CreditCard, section: 'activity' },
  { href: '/app/messages', label: 'Messages', icon: MessagesSquare, section: 'activity' },
] as const

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  if (href === '/app/dashboard') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Sidebar permanente 240px (Design System v4).
 * Navy ultra-deep `#0F2436`, logo en haut, 2 sections séparées par divider,
 * theme toggle + user info en bas. Active state : bg navy-700 + barre cyan glow.
 *
 * Spec : docs/design/KOVAS_UIUX_App_Complete_v4.md §4.
 */
export function AppSidebar() {
  const pathname = usePathname()
  const mainItems = NAV.filter((n) => n.section === 'main')
  const activityItems = NAV.filter((n) => n.section === 'activity')

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col bg-[hsl(var(--navy-900))] text-white sticky top-0 self-start h-dvh">
      {/* Logo + nom marque */}
      <div className="px-6 pt-6 pb-8 flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-md bg-white text-[hsl(var(--navy-900))] font-bold text-base"
        >
          K
        </span>
        <span className="text-base font-bold tracking-tight">KOVAS</span>
      </div>

      {/* Nav principale */}
      <nav className="flex-1 overflow-y-auto px-3 space-y-6" aria-label="Navigation principale">
        <SidebarSection items={mainItems} pathname={pathname} />

        <div className="px-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40 mb-2">
            Activité
          </p>
          <SidebarSection items={activityItems} pathname={pathname} />
        </div>
      </nav>

      {/* Footer : theme toggle */}
      <div className="px-3 pb-4 pt-2 border-t border-white/10">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs text-white/60">Thème</span>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}

function SidebarSection({
  items,
  pathname,
}: {
  items: readonly NavItem[]
  pathname: string | null
}) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <li key={item.href} className="relative">
            {active && (
              <span
                aria-hidden
                className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-[hsl(var(--cyan-mid))] shadow-[0_0_8px_2px_hsl(var(--cyan-mid)/0.6)]"
              />
            )}
            <Link
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-fast',
                active
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-white/70 hover:bg-white/5 hover:text-white',
              )}
            >
              <item.icon className="size-4 shrink-0" strokeWidth={1.75} />
              <span className="flex-1 truncate">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[hsl(var(--cyan-mid))] text-[10px] font-bold text-[hsl(var(--navy-900))]">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Bottom-nav mobile (< md). Icônes + label court.
 * 5 tabs : Aujourd'hui · Dossiers · [+] CTA central · Planning · Compte.
 * Spec v4 §4.
 */
export function AppMobileNav() {
  const pathname = usePathname()
  const tabs = [
    { href: '/app/dashboard', label: "Aujourd'hui", icon: Home },
    { href: '/app/dossiers', label: 'Dossiers', icon: FileText },
    { href: '/app/calendar', label: 'Planning', icon: CalendarDays },
    { href: '/app/account', label: 'Compte', icon: Users },
  ] as const

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[hsl(var(--navy-900))] border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      aria-label="Navigation mobile"
    >
      <div className="flex items-stretch">
        {tabs.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors duration-fast',
                active ? 'text-white font-semibold' : 'text-white/60',
              )}
            >
              <item.icon className="size-5" strokeWidth={1.75} />
              <span>{item.label.split(' ')[0]}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
