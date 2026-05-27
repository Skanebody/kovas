'use client'

import type { AddonCode, PricingPlanCode } from '@/lib/pricing-plans'
import type { UserAccess } from '@/lib/upsell/access-control'
import { hasFeatureAccess } from '@/lib/upsell/access-control'
import { cn } from '@/lib/utils'
import { Building2, CalendarDays, ChartLine, FileText, Home, Settings, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  requiredTier?: PricingPlanCode
  requiredAddons?: readonly AddonCode[]
}

/**
 * Sitemap V1 — 7 sections principales (CLAUDE.md §9 Design System v5).
 *   Aujourd'hui · Dossiers · Planning · Clients · Biens · Performance · Compte
 *
 * Filtrées via `hasFeatureAccess` selon le plan + addons actifs de l'utilisateur,
 * cohérent avec la sidebar verticale (cf. app-sidebar.tsx NAV_MAIN).
 */
const NAV: readonly NavItem[] = [
  { href: '/dashboard/dashboard', label: 'Tableau de bord', icon: Home },
  { href: '/dashboard/dossiers', label: 'Dossiers', icon: FileText },
  { href: '/dashboard/calendar', label: 'Calendrier', icon: CalendarDays },
  { href: '/dashboard/clients', label: 'Clients', icon: Users },
  { href: '/dashboard/properties', label: 'Biens', icon: Building2 },
  { href: '/dashboard/analytics', label: 'Statistiques', icon: ChartLine },
  { href: '/dashboard/account', label: 'Compte', icon: Settings },
] as const

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  if (href === '/dashboard/dashboard') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export interface AppNavTabsProps {
  /** UserAccess pour filtrer les items qui nécessitent un tier/addon. */
  access: UserAccess
}

/**
 * Tabs pillules navigation primaire — header desktop.
 * cf. docs/design-system.md §2 (Tabs) + §3 (App shell).
 *
 * Affiche les 7 sections V1 (Aujourd'hui, Dossiers, Planning, Clients, Biens,
 * Performance, Compte) filtrées par accès. Cohérent avec la sidebar 80px.
 */
export function AppNavTabs({ access }: AppNavTabsProps) {
  const pathname = usePathname()
  const accessibleItems = NAV.filter((item) => hasFeatureAccess(access, item))

  return (
    <nav className="hidden md:flex items-center gap-1 rounded-pill bg-paper/85 backdrop-blur-xl border border-rule/60 p-1 shadow-glass-sm">
      {accessibleItems.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-pill px-4 py-1.5 text-sm transition-colors',
              active
                ? 'bg-navy text-paper font-semibold shadow-accent'
                : 'text-ink-mute hover:text-ink font-medium',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
