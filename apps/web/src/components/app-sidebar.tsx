'use client'

import { MobileMoreSheet } from '@/components/mobile-more-sheet'
import { ThemeToggle } from '@/components/theme-toggle'
import { DiscoverSidebarButton } from '@/components/upsell/DiscoverSidebarButton'
import { cn } from '@/lib/utils'
import type { TrackAccess } from '@/lib/access/track-access'
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
  Inbox,
  IdCard,
  Menu,
  MessageSquare,
  Radar,
  Receipt,
  ScrollText,
  Search,
  Send,
  Settings,
  Sparkles,
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
  { href: '/dashboard/dashboard', label: "Aujourd'hui", icon: Home },
  { href: '/dashboard/dossiers', label: 'Dossiers', icon: FileText },
  { href: '/dashboard/calendar', label: 'Planning', icon: CalendarDays },
  { href: '/dashboard/clients', label: 'Clients', icon: Users },
  { href: '/dashboard/properties', label: 'Biens', icon: Building2 },
  { href: '/dashboard/devis', label: 'Devis', icon: ScrollText },
  { href: '/dashboard/factures', label: 'Factures', icon: Receipt },
  { href: '/dashboard/relances', label: 'Relances', icon: Send },
  { href: '/dashboard/gain', label: 'Performance', icon: ChartLine },
  { href: '/dashboard/cockpit-ademe', label: 'Cockpit ADEME', icon: Radar, requiredTier: 'pro' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: TrendingUp, requiredTier: 'pro' },
  { href: '/dashboard/veille', label: 'Veille', icon: Bell, requiredAddons: ['regulatory_watch'] },
  {
    href: '/dashboard/communaute',
    label: 'Communauté',
    icon: MessageSquare,
    requiredAddons: ['community_pro'],
  },
  { href: '/dashboard/prescripteurs', label: 'Prescripteurs', icon: Briefcase, requiredTier: 'pro' },
  { href: '/dashboard/archive', label: 'Mes fichiers', icon: Archive },
  { href: '/dashboard/outils', label: 'Outils', icon: Wrench },
] as const

/**
 * Items spécifiques au track Annuaire (B2C lead-gen) — affichés quand
 * l'organisation a une souscription annuaire active (annuaire-only ou dual).
 *
 * Phase C 2026-05-21 : profil annuaire + leads reçus + analytics fiche.
 */
const NAV_ANNUAIRE: readonly NavItem[] = [
  { href: '/dashboard/annuaire/profile', label: 'Profil annuaire', icon: IdCard },
  { href: '/dashboard/annuaire/leads', label: 'Leads reçus', icon: Inbox },
  { href: '/dashboard/annuaire/stats', label: 'Stats fiche', icon: TrendingUp },
] as const

const NAV_BOTTOM: readonly NavItem[] = [
  { href: '/dashboard/account', label: 'Compte', icon: Settings },
] as const

interface UpsellCTA {
  href: string
  label: string
}

/**
 * CTA cross-sell sticky en bas de sidebar selon le track de l'user :
 *  - annuaire-only → propose KOVAS 360 (logiciel)
 *  - logiciel-only → propose KOVAS Annuaire (B2C lead-gen)
 *  - free          → propose le Bundle (parcours essai)
 *  - dual          → pas de CTA (déjà tout souscrit)
 */
function getUpsellCTA(track: TrackAccess): UpsellCTA | null {
  switch (track) {
    case 'annuaire-only':
      return { href: '/dashboard/upgrade/logiciel', label: 'Découvrir KOVAS 360' }
    case 'logiciel-only':
      return { href: '/dashboard/upgrade/annuaire', label: 'Découvrir KOVAS Annuaire' }
    case 'free':
      return { href: '/dashboard/upgrade/bundle', label: 'Démarrer un essai' }
    case 'dual':
    default:
      return null
  }
}

/**
 * Compose la liste d'items principaux selon le track dual :
 *  - free          : Aujourd'hui uniquement (la sidebar reste minimale, CTA push tout en bas)
 *  - annuaire-only : Aujourd'hui + items annuaire (pas de dossiers/devis/factures)
 *  - logiciel-only : items logiciel V1 standards (NAV_MAIN inchangé)
 *  - dual          : mix complet = logiciel + items annuaire spécifiques
 */
function getMainNavForTrack(track: TrackAccess): readonly NavItem[] {
  switch (track) {
    case 'free':
      return [{ href: '/dashboard/dashboard', label: "Aujourd'hui", icon: Home }]
    case 'annuaire-only':
      return [
        { href: '/dashboard/dashboard', label: "Aujourd'hui", icon: Home },
        ...NAV_ANNUAIRE,
      ]
    case 'dual':
      return [...NAV_MAIN, ...NAV_ANNUAIRE]
    case 'logiciel-only':
    default:
      return NAV_MAIN
  }
}

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  if (href === '/dashboard/dashboard') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export interface AppSidebarProps {
  /** UserAccess pré-chargé côté server. */
  access: UserAccess
  /** Suggestions pending pour le badge dot chartreuse. */
  suggestions: readonly PendingUpsellSuggestion[]
  /** Track dual (annuaire-only / logiciel-only / dual / free). */
  track: TrackAccess
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
export function AppSidebar({ access, suggestions, track }: AppSidebarProps) {
  const pathname = usePathname()

  // Phase C — Dual track : items filtrés par track puis par features
  // (un user annuaire-only ne voit pas Dossiers, Devis, etc. même s'il a
  // un legacy `decouverte` plan vu que son track est `annuaire-only`).
  const trackItems = getMainNavForTrack(track)
  const accessibleItems = trackItems.filter((item) => hasFeatureAccess(access, item))
  const upsellCta = getUpsellCTA(track)

  return (
    <aside
      className="hidden md:flex w-20 shrink-0 flex-col items-center sticky top-0 self-start h-dvh"
      style={{ backgroundColor: '#0F1419' }}
      aria-label="Navigation principale"
    >
      {/* Logo K monogramme 32×32 */}
      <Link href="/dashboard/dashboard" className="mt-4 mb-6" aria-label="KOVAS — Tableau de bord">
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

      {/* Footer : Découvrir + cross-sell dual track + search + compte + theme */}
      <div className="flex flex-col gap-1 px-2 pb-4 mt-auto">
        <DiscoverSidebarButton access={access} suggestions={suggestions} />
        {upsellCta && (
          <Link
            href={upsellCta.href}
            title={upsellCta.label}
            aria-label={upsellCta.label}
            className="relative flex size-12 items-center justify-center rounded-md text-white/65 hover:text-white transition-colors"
            style={{ backgroundColor: 'rgba(212, 245, 66, 0.08)' }}
          >
            <Sparkles className="size-5" strokeWidth={1.75} style={{ color: '#D4F542' }} />
          </Link>
        )}
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
  track: TrackAccess
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
export function AppMobileNav({ access, suggestions, track }: AppMobileNavProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  // Phase C — Dual track : 4 tabs adaptés selon track
  const tabs: ReadonlyArray<NavItem> =
    track === 'annuaire-only'
      ? [
          { href: '/dashboard/dashboard', label: 'Auj.', icon: Home },
          { href: '/dashboard/annuaire/leads', label: 'Leads', icon: Inbox },
          { href: '/dashboard/annuaire/profile', label: 'Profil', icon: IdCard },
          { href: '/dashboard/account', label: 'Compte', icon: Settings },
        ]
      : track === 'free'
        ? [
            { href: '/dashboard/dashboard', label: 'Auj.', icon: Home },
            { href: '/dashboard/upgrade/bundle', label: 'Découvrir', icon: Sparkles },
            { href: '/dashboard/account', label: 'Compte', icon: Settings },
          ]
        : [
            // logiciel-only et dual partagent les mêmes tabs primaires
            { href: '/dashboard/dashboard', label: 'Auj.', icon: Home },
            { href: '/dashboard/dossiers', label: 'Dossiers', icon: FileText },
            { href: '/dashboard/calendar', label: 'Plan.', icon: CalendarDays },
            { href: '/dashboard/account', label: 'Compte', icon: Settings },
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
        track={track}
      />
    </>
  )
}
