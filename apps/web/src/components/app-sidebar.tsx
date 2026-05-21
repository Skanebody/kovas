'use client'

import { MobileMoreSheet } from '@/components/mobile-more-sheet'
import { ThemeToggle } from '@/components/theme-toggle'
import { DiscoverSidebarButton } from '@/components/upsell/DiscoverSidebarButton'
import { cn } from '@/lib/utils'
import type { UserAccess } from '@/lib/upsell/access-control'
import { hasFeatureAccess } from '@/lib/upsell/access-control'
import type { PendingUpsellSuggestion } from '@/lib/upsell/load-access'
import type { AddonCode, PricingPlanCode } from '@/lib/pricing-plans'
import {
  Archive,
  Bell,
  Briefcase,
  Building2,
  CalendarDays,
  ChartLine,
  FileText,
  Home,
  Menu,
  MessageSquare,
  Radar,
  Receipt,
  ScrollText,
  Search,
  Send,
  Settings,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  requiredTier?: PricingPlanCode
  requiredAddons?: readonly AddonCode[]
}

/**
 * Sitemap V1 + extensions modules 1-9 (2026-05-25), enrichi L1 (upsell
 * intelligent 2026-06-05) avec `requiredTier` / `requiredAddons` par item.
 *
 * Filtrage via `filterNavItemsByAccess` côté layout : un user Essential
 * ne voit pas "Analytics", "Cockpit ADEME", "Communauté", etc. tant qu'il
 * n'a pas le tier ou l'addon nécessaire. Discoverabilité via le bouton
 * "Découvrir" sticky en bas.
 */
const NAV_MAIN: readonly NavItem[] = [
  { href: '/app/dashboard', label: "Aujourd'hui", icon: Home },
  { href: '/app/dossiers', label: 'Dossiers', icon: FileText },
  { href: '/app/calendar', label: 'Planning', icon: CalendarDays },
  { href: '/app/clients', label: 'Clients', icon: Users },
  { href: '/app/properties', label: 'Biens', icon: Building2 },
  { href: '/app/devis', label: 'Devis', icon: ScrollText },
  { href: '/app/factures', label: 'Factures', icon: Receipt },
  { href: '/app/relances', label: 'Relances', icon: Send },
  { href: '/app/gain', label: 'Performance', icon: ChartLine },
  { href: '/app/cockpit-ademe', label: 'Cockpit ADEME', icon: Radar, requiredTier: 'pro' },
  { href: '/app/analytics', label: 'Analytics', icon: TrendingUp, requiredTier: 'pro' },
  { href: '/app/veille', label: 'Veille', icon: Bell, requiredAddons: ['regulatory_watch'] },
  {
    href: '/app/communaute',
    label: 'Communauté',
    icon: MessageSquare,
    requiredAddons: ['community_pro'],
  },
  { href: '/app/prescripteurs', label: 'Prescripteurs', icon: Briefcase, requiredTier: 'pro' },
  { href: '/app/archive', label: 'Mes fichiers', icon: Archive },
  { href: '/app/outils', label: 'Outils', icon: Wrench },
] as const

const NAV_BOTTOM: readonly NavItem[] = [
  { href: '/app/account', label: 'Compte', icon: Settings },
] as const

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  if (href === '/app/dashboard') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export interface AppSidebarProps {
  /** UserAccess pré-chargé côté server. */
  access: UserAccess
  /** Suggestions pending pour le badge dot chartreuse. */
  suggestions: readonly PendingUpsellSuggestion[]
}

/**
 * AppSidebar v5 — 80px icon-only pattern Synthex.
 * Fond #0F1419 (noir bleuté), icônes 24px blanc 60%, active barre
 * chartreuse 3px à gauche, tooltip natif au hover.
 *
 * L1 (2026-06-05) : items filtrés selon UserAccess. Bouton "Découvrir"
 * (Sparkles) en bas avec dot chartreuse si suggestion pending.
 *
 * Spec : docs/design/KOVAS_UIUX_v5_Final.md §3 + Navigation.
 */
export function AppSidebar({ access, suggestions }: AppSidebarProps) {
  const pathname = usePathname()

  const accessibleItems = NAV_MAIN.filter((item) => hasFeatureAccess(access, item))

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

      {/* Nav principale filtrée — scroll vertical activé pour absorber 14 items sans débordement */}
      <nav
        className="flex flex-col gap-1 flex-1 px-2 overflow-y-auto scrollbar-none"
        style={{ scrollbarWidth: 'none' }}
      >
        {accessibleItems.map((item) => (
          <SidebarIconButton key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>

      {/* Footer : Découvrir + search + compte + theme */}
      <div className="flex flex-col gap-1 px-2 pb-4 mt-auto">
        <DiscoverSidebarButton access={access} suggestions={suggestions} />
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

export interface AppMobileNavProps {
  access: UserAccess
  suggestions: readonly PendingUpsellSuggestion[]
}

/**
 * AppMobileNav v5 — 5 tabs iOS-style fond #0F1419.
 *
 * 4 Links + 1 bouton "Plus" qui ouvre MobileMoreSheet (bottom sheet contenant
 * les 10 sections KOVAS V1 non représentées dans la barre).
 *
 * L1 (2026-06-05) : passe l'access aux composants enfants pour filtrage +
 * passe les suggestions pour le badge dot dans "Plus".
 */
export function AppMobileNav({ access, suggestions }: AppMobileNavProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  const tabs: ReadonlyArray<NavItem> = [
    { href: '/app/dashboard', label: 'Auj.', icon: Home },
    { href: '/app/dossiers', label: 'Dossiers', icon: FileText },
    { href: '/app/calendar', label: 'Plan.', icon: CalendarDays },
    { href: '/app/account', label: 'Compte', icon: Settings },
  ]

  const hasSuggestion = suggestions.length > 0

  return (
    <>
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

          {/* 5e tab : bouton "Plus" → ouvre MobileMoreSheet */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-controls="mobile-more-sheet"
            className={cn(
              'relative flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors',
              moreOpen ? 'text-white font-semibold' : 'text-white/60',
            )}
          >
            <Menu className="size-5" strokeWidth={1.75} />
            <span>Plus</span>
            {hasSuggestion ? (
              <span
                aria-hidden
                className="absolute top-1.5 right-[calc(50%-14px)] size-1.5 rounded-full"
                style={{ backgroundColor: '#D4F542' }}
              />
            ) : null}
          </button>
        </div>
      </nav>

      <MobileMoreSheet
        open={moreOpen}
        onOpenChange={setMoreOpen}
        access={access}
        suggestions={suggestions}
      />
    </>
  )
}
