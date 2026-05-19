'use client'

import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'
import {
  Building2,
  CalendarDays,
  ChartLine,
  FileText,
  Home,
  Search,
  Settings,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

/**
 * Sitemap V1 canonique (cf. docs/design/KOVAS_UIUX_v5_Final.md §2) :
 * - Aujourd'hui (dashboard du jour)
 * - Dossiers (liste filtrable)
 * - Planning (vue semaine V1, jour/mois V1.5)
 * - Clients (liste recherchable)
 * - Biens (liste + recherche)
 * - Performance (KPI mois + GainTracker bar pilules)
 * - Compte (4 sections : Profil / Entreprise / Abonnement / Préférences)
 *
 * Pages V1.5 retirées de la sidebar V1 (facturation, messages) :
 * délégation Gestiondiag/Pennylane + email natif suffisent.
 */
const NAV_MAIN: readonly NavItem[] = [
  { href: '/app/dashboard', label: "Aujourd'hui", icon: Home },
  { href: '/app/dossiers', label: 'Dossiers', icon: FileText },
  { href: '/app/calendar', label: 'Planning', icon: CalendarDays },
  { href: '/app/clients', label: 'Clients', icon: Users },
  { href: '/app/properties', label: 'Biens', icon: Building2 },
  { href: '/app/gain', label: 'Performance', icon: ChartLine },
] as const

const NAV_BOTTOM: readonly NavItem[] = [
  { href: '/app/account', label: 'Compte', icon: Settings },
] as const

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  if (href === '/app/dashboard') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * AppSidebar v5 — 80px icon-only pattern Synthex.
 * Fond #0F1419 (noir bleuté), icônes 24px blanc 60%, active barre
 * chartreuse 3px à gauche, tooltip natif au hover.
 *
 * Spec : docs/design/KOVAS_UIUX_v5_Final.md §3 + Navigation.
 */
export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="hidden md:flex w-20 shrink-0 flex-col items-center sticky top-0 self-start h-dvh"
      style={{ backgroundColor: '#0F1419' }}
      aria-label="Navigation principale"
    >
      {/* Logo K monogramme 32×32 */}
      <Link href="/app/dashboard" className="mt-4 mb-6" aria-label="KOVAS — Tableau de bord">
        <div
          aria-hidden
          className="flex size-8 items-center justify-center rounded-md bg-white text-[#0F1419] font-bold text-sm"
        >
          K
        </div>
      </Link>

      {/* Nav principale */}
      <nav className="flex flex-col gap-1 flex-1 px-2">
        {NAV_MAIN.map((item) => (
          <SidebarIconButton key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>

      {/* Footer : search + compte + theme + avatar */}
      <div className="flex flex-col gap-1 px-2 pb-4 mt-auto">
        <button
          type="button"
          className="flex size-12 items-center justify-center rounded-md text-white/65 hover:bg-white/[0.06] hover:text-white transition-colors"
          title="Rechercher (⌘K)"
          aria-label="Rechercher"
          data-cmdk-trigger
        >
          <Search className="size-5" strokeWidth={1.75} />
        </button>
        {NAV_BOTTOM.map((item) => (
          <SidebarIconButton key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
        <div className="flex size-12 items-center justify-center text-white/65 hover:text-white transition-colors">
          <ThemeToggle />
        </div>
      </div>
    </aside>
  )
}

function SidebarIconButton({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      title={item.label}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex size-12 items-center justify-center rounded-md transition-colors duration-150',
        active
          ? 'bg-white/[0.08] text-white'
          : 'text-white/60 hover:bg-white/[0.06] hover:text-white',
      )}
    >
      {/* Barre active chartreuse 3px à gauche */}
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
          style={{ backgroundColor: '#D4F542' }}
        />
      )}
      <Icon className="size-5" strokeWidth={1.75} />
    </Link>
  )
}

/**
 * AppMobileNav v5 — 5 tabs iOS-style fond #0F1419.
 * 4 tabs nav + 1 FAB central chartreuse via MobileQuickActionsFab.
 */
export function AppMobileNav() {
  const pathname = usePathname()
  const tabs = [
    { href: '/app/dashboard', label: "Auj.", icon: Home },
    { href: '/app/dossiers', label: 'Dossiers', icon: FileText },
    { href: '/app/calendar', label: 'Plan.', icon: CalendarDays },
    { href: '/app/account', label: 'Compte', icon: Settings },
  ] as const

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      style={{ backgroundColor: '#0F1419' }}
      aria-label="Navigation mobile"
    >
      <div className="flex items-stretch">
        {tabs.map((item) => {
          const active = isActive(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors',
                active ? 'text-white font-semibold' : 'text-white/60',
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="size-5" strokeWidth={1.75} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
