'use client'

/**
 * KOVAS — AppSidebar (refonte Linear-style 2026-05-23).
 *
 * Sidebar 5 zones :
 *   Z1 — Avatar / identité (toujours visible en haut)
 *   Z2 — Workflow quotidien (5 items par défaut)
 *   Z3 — Business (3 items par défaut)
 *   Z4 — Menu "Plus" (collapsible)
 *   Z5 — Système (Aide / Paramètres / Personnaliser + toggle collapse)
 *
 * Largeurs : 240px étendue / 64px collapsed.
 * Fond #0F1419 (navy). Active bar chartreuse 3px à gauche.
 *
 * L1 dual-track : items filtrés par `track` + `access`. Si `track === 'free'`
 * ou `track === 'annuaire-only'`, on retombe sur l'ancien rendu minimal pour
 * ne pas casser ces parcours (le redesign vise le track logiciel/dual).
 *
 * Mobile : ce composant ne s'affiche pas (`hidden md:flex`). La nav mobile
 * est gérée par `AppMobileNav` ci-dessous + `MobileMoreSheet`.
 */

import { cn } from '@/lib/utils'
import { ChevronLeft, HelpCircle, Inbox, LayoutGrid, Settings, UserSquare } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useMemo, useState } from 'react'

import { MobileMoreSheet } from '@/components/mobile-more-sheet'
import { SidebarAvatar } from '@/components/sidebar/SidebarAvatar'
import { SidebarCustomizer } from '@/components/sidebar/SidebarCustomizer'
import { SidebarItem } from '@/components/sidebar/SidebarItem'
import { SidebarKeyboardShortcuts } from '@/components/sidebar/SidebarKeyboardShortcuts'
import { SidebarMoreMenu } from '@/components/sidebar/SidebarMoreMenu'
import { DiscoverSidebarButton } from '@/components/upsell/DiscoverSidebarButton'

import type { TrackAccess } from '@/lib/access/track-access'
import type { SidebarBadgeCounts } from '@/lib/sidebar/badge-counts'
import { useSidebarPreferences } from '@/lib/sidebar/preferences-client'
import type { SidebarPreferences, SidebarPreferencesItem } from '@/lib/sidebar/preferences-types'
import {
  SIDEBAR_ITEMS_BY_ID,
  SYSTEM_ITEMS,
  type SidebarItemDef,
  type SidebarItemId,
} from '@/lib/sidebar/sidebar-items'
import { type UserAccess, hasFeatureAccess } from '@/lib/upsell/access-control'
import type { PendingUpsellSuggestion } from '@/lib/upsell/load-access'

const NAVY_INK = '#0F1419'
const NAVY_DIVIDER = '#2A3038'
const CHARTREUSE = '#D4F542'

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  if (href === '/dashboard/dashboard') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Hydrate la préférence (SidebarPreferencesItem) en (SidebarItemDef) + filtre
 * par accès. Ordonne selon la `position`. Items dont l'accès est manquant
 * sont silencieusement omis.
 */
function hydrate(
  prefsItems: readonly SidebarPreferencesItem[],
  access: UserAccess,
  onlyVisible: boolean,
): SidebarItemDef[] {
  const sorted = [...prefsItems].sort((a, b) => a.position - b.position)
  const result: SidebarItemDef[] = []
  for (const it of sorted) {
    if (onlyVisible && !it.visible) continue
    const def = SIDEBAR_ITEMS_BY_ID.get(it.id as SidebarItemId)
    if (!def) continue
    if (!hasFeatureAccess(access, def)) continue
    result.push(def)
  }
  return result
}

/**
 * Détermine si on doit utiliser la nouvelle sidebar pleine.
 * On l'active pour track `logiciel-only` et `dual` ; pour `free`/`annuaire-only`
 * on rend un fallback minimal style v5 (icon-only 80px) pour ne pas casser
 * ces parcours qui ont leur propre structure.
 */
function isFullSidebarTrack(track: TrackAccess): boolean {
  return track === 'logiciel-only' || track === 'dual'
}

export interface AppSidebarProps {
  access: UserAccess
  suggestions: readonly PendingUpsellSuggestion[]
  track: TrackAccess
  /** Préférences sidebar chargées server-side (refonte 2026-05-23). */
  preferences: SidebarPreferences
  badgeCounts: SidebarBadgeCounts
  /** Identité user (pour avatar zone 1). */
  user: {
    id: string
    displayName: string
    email: string
    avatarUrl?: string | null
  }
  /** Server Action de déconnexion. */
  onLogout: () => Promise<void>
  /** Server Action de save des préférences. */
  saveAction: (prefs: SidebarPreferences) => Promise<void>
}

export function AppSidebar(props: AppSidebarProps) {
  const { access, suggestions, track } = props
  // Fallback minimal pour free / annuaire-only
  if (!isFullSidebarTrack(track)) {
    return <AppSidebarFallback access={access} suggestions={suggestions} track={track} />
  }
  return <AppSidebarFull {...props} />
}

function AppSidebarFull({
  access,
  suggestions,
  preferences,
  badgeCounts,
  user,
  onLogout,
  saveAction,
}: AppSidebarProps) {
  const pathname = usePathname()
  const { prefs, setPrefs, toggleCollapsed } = useSidebarPreferences(
    preferences,
    user.id,
    saveAction,
  )
  const [customizerOpen, setCustomizerOpen] = useState(false)

  const collapsed = prefs.sidebarCollapsed
  const width = collapsed ? 64 : 240

  // Items hydratés + filtrés par accès
  const mainDefs = useMemo(() => hydrate(prefs.mainItems, access, true), [prefs.mainItems, access])
  const moreDefs = useMemo(() => hydrate(prefs.moreItems, access, true), [prefs.moreItems, access])

  // Split visuel main : workflow (5 premiers) / business (le reste) — séparateur fin
  // Heuristique : on coupe à index 5 sauf si moins de 6 items au total.
  const workflowItems = mainDefs.slice(0, Math.min(5, mainDefs.length))
  const businessItems = mainDefs.slice(Math.min(5, mainDefs.length))

  const handleSave = useCallback(
    (next: SidebarPreferences) => {
      setPrefs(next)
    },
    [setPrefs],
  )

  return (
    <>
      <aside
        className={cn(
          'hidden md:flex shrink-0 flex-col sticky top-0 self-start h-dvh transition-[width] duration-200 ease-in-out',
        )}
        style={{ backgroundColor: NAVY_INK, width }}
        aria-label="Navigation principale"
      >
        {/* Z1 — Avatar identité */}
        <div className="px-2 pt-3 pb-3">
          <SidebarAvatar
            displayName={user.displayName}
            email={user.email}
            avatarUrl={user.avatarUrl}
            collapsed={collapsed}
            onLogout={onLogout}
          />
        </div>

        {/* Z2 + Z3 — Workflow + Business */}
        <nav
          className="flex-1 overflow-y-auto overflow-x-hidden px-2 pt-1 pb-2 space-y-0.5 scrollbar-none"
          style={{ scrollbarWidth: 'none' }}
        >
          {workflowItems.map((def) => (
            <SidebarItem
              key={def.id}
              href={def.href}
              label={def.label}
              tooltip={def.tooltip}
              icon={def.icon}
              active={isActive(pathname, def.href)}
              collapsed={collapsed}
              badgeCount={def.badgeKey ? badgeCounts[def.badgeKey] : undefined}
              notificationStyle={prefs.notificationStyle}
              accent={def.accent}
            />
          ))}

          {businessItems.length > 0 ? (
            <hr
              className="my-2 border-0 h-px"
              style={{ backgroundColor: NAVY_DIVIDER }}
              aria-hidden
            />
          ) : null}

          {businessItems.map((def) => (
            <SidebarItem
              key={def.id}
              href={def.href}
              label={def.label}
              tooltip={def.tooltip}
              icon={def.icon}
              active={isActive(pathname, def.href)}
              collapsed={collapsed}
              badgeCount={def.badgeKey ? badgeCounts[def.badgeKey] : undefined}
              notificationStyle={prefs.notificationStyle}
              accent={def.accent}
            />
          ))}

          {/* Z4 — Menu Plus */}
          {moreDefs.length > 0 ? (
            <div className="pt-1">
              <SidebarMoreMenu
                items={moreDefs}
                collapsed={collapsed}
                badgeCounts={badgeCounts}
                notificationStyle={prefs.notificationStyle}
              />
            </div>
          ) : null}

          {/* Bouton Découvrir (upsell) — sticky bas zone nav */}
          <div className="pt-2">
            <DiscoverSidebarButton access={access} suggestions={suggestions} />
          </div>
        </nav>

        {/* Séparateur Z4 ↔ Z5 */}
        <hr className="border-0 h-px mx-2" style={{ backgroundColor: NAVY_DIVIDER }} aria-hidden />

        {/* Z5 — Système (Aide / Paramètres / Personnaliser) + toggle collapse */}
        <div className="px-2 py-2 space-y-0.5">
          <SidebarItem
            href={SYSTEM_ITEMS.aide.href}
            label={SYSTEM_ITEMS.aide.label}
            icon={SYSTEM_ITEMS.aide.icon}
            active={isActive(pathname, SYSTEM_ITEMS.aide.href)}
            collapsed={collapsed}
          />
          <SidebarItem
            href={SYSTEM_ITEMS.parametres.href}
            label={SYSTEM_ITEMS.parametres.label}
            icon={SYSTEM_ITEMS.parametres.icon}
            active={isActive(pathname, SYSTEM_ITEMS.parametres.href)}
            collapsed={collapsed}
          />
          <SidebarItem
            href="#"
            label={SYSTEM_ITEMS.personnaliser.label}
            icon={SYSTEM_ITEMS.personnaliser.icon}
            active={false}
            collapsed={collapsed}
            onClick={() => setCustomizerOpen(true)}
            ariaLabel="Personnaliser la barre latérale"
            ariaHasPopup={true}
            ariaExpanded={customizerOpen}
          />
        </div>

        {/* Toggle collapse (chevron en bas) */}
        <div className="px-2 pb-3">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Étendre la barre latérale' : 'Réduire la barre latérale'}
            title={collapsed ? 'Étendre' : 'Réduire'}
            className={cn(
              'group w-full flex items-center justify-center rounded-[10px] h-9 transition-colors duration-200 outline-none',
              'hover:bg-[#1A1F26] focus-visible:ring-2',
            )}
            style={{ ['--tw-ring-color' as string]: CHARTREUSE }}
          >
            <ChevronLeft
              className={cn(
                'size-4 transition-transform duration-200',
                collapsed ? 'rotate-180' : 'rotate-0',
              )}
              strokeWidth={1.5}
              style={{ color: 'rgba(255,255,255,0.65)' }}
            />
          </button>
        </div>
      </aside>

      <SidebarCustomizer
        open={customizerOpen}
        onOpenChange={setCustomizerOpen}
        prefs={prefs}
        onSave={handleSave}
      />

      <SidebarKeyboardShortcuts mainItems={prefs.mainItems} />
    </>
  )
}

/**
 * Fallback minimal pour track `free` / `annuaire-only` — conserve l'ancien
 * comportement 80px icon-only, mais sans personnalisation.
 */
interface AppSidebarFallbackProps {
  access: UserAccess
  suggestions: readonly PendingUpsellSuggestion[]
  track: TrackAccess
}

function AppSidebarFallback({ access, suggestions, track }: AppSidebarFallbackProps) {
  const pathname = usePathname()

  const items: readonly { href: string; label: string; icon: SidebarItemDef['icon'] }[] =
    track === 'annuaire-only'
      ? [
          {
            href: '/dashboard/dashboard',
            label: "Aujourd'hui",
            icon: SYSTEM_ITEMS.parametres.icon,
          },
          // Hub annuaire (Ma fiche · Reviews · Stats) — créé pour le track
          // annuaire-only afin que le diag ait un point d'entrée centralisé
          // vers la gestion de sa fiche publique.
          { href: '/dashboard/annuaire', label: 'Ma fiche', icon: UserSquare },
          { href: '/dashboard/leads/incoming', label: 'Leads reçus', icon: Inbox },
        ]
      : [{ href: '/dashboard/dashboard', label: "Aujourd'hui", icon: LayoutGrid }]

  return (
    <aside
      className="hidden md:flex w-20 shrink-0 flex-col items-center sticky top-0 self-start h-dvh"
      style={{ backgroundColor: NAVY_INK }}
      aria-label="Navigation principale"
    >
      <Link href="/dashboard/dashboard" className="mt-4 mb-6" aria-label="KOVAS — Tableau de bord">
        <div
          aria-hidden
          className="flex size-8 items-center justify-center rounded-md bg-white text-[#0F1419] font-bold text-sm"
        >
          K
        </div>
      </Link>

      <nav className="flex flex-col gap-1 flex-1 px-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            className={cn(
              'relative flex size-12 items-center justify-center rounded-md transition-colors',
              isActive(pathname, item.href)
                ? 'bg-white/[0.08] text-white'
                : 'text-white/60 hover:bg-white/[0.06] hover:text-white',
            )}
          >
            {isActive(pathname, item.href) ? (
              <span
                aria-hidden
                className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full"
                style={{ backgroundColor: CHARTREUSE }}
              />
            ) : null}
            <item.icon className="size-5" strokeWidth={1.5} />
          </Link>
        ))}
      </nav>

      <div className="flex flex-col gap-1 px-2 pb-4 mt-auto">
        <DiscoverSidebarButton access={access} suggestions={suggestions} />
        <Link
          href="/dashboard/account"
          title="Compte"
          aria-label="Compte"
          className="relative flex size-12 items-center justify-center rounded-md text-white/65 hover:bg-white/[0.06] hover:text-white transition-colors"
        >
          <Settings className="size-5" strokeWidth={1.5} />
        </Link>
        <Link
          href="/dashboard/aide"
          title="Aide"
          aria-label="Aide"
          className="relative flex size-12 items-center justify-center rounded-md text-white/65 hover:bg-white/[0.06] hover:text-white transition-colors"
        >
          <HelpCircle className="size-5" strokeWidth={1.5} />
        </Link>
      </div>
    </aside>
  )
}

// =============================================================================
// MOBILE NAV — Bottom tab bar 5 items (refonte 2026-05-23)
// =============================================================================

export interface AppMobileNavProps {
  access: UserAccess
  suggestions: readonly PendingUpsellSuggestion[]
  track: TrackAccess
  /** Items visibles de la sidebar (5 premiers utilisés en bottom bar). */
  preferences?: SidebarPreferences
  badgeCounts?: SidebarBadgeCounts
}

/**
 * Bottom tab bar mobile — 5 items :
 *  - 4 raccourcis principaux (Accueil, Dossiers, Capture, Calendrier)
 *  - 1 bouton "Plus" qui ouvre MobileMoreSheet
 *
 * Touch targets >= 48px. Active = dot chartreuse en-dessous + icône chartreuse.
 */
export function AppMobileNav({
  access,
  suggestions,
  track,
  preferences,
  badgeCounts,
}: AppMobileNavProps) {
  const pathname = usePathname()
  const [moreOpen, setMoreOpen] = useState(false)

  // 4 raccourcis principaux — dérivés des préférences si dispo, sinon defaults
  const visibleMain = preferences
    ? preferences.mainItems
        .filter((i) => i.visible)
        .map((i) => SIDEBAR_ITEMS_BY_ID.get(i.id as SidebarItemId))
        .filter((d): d is SidebarItemDef => Boolean(d))
        .filter((d) => hasFeatureAccess(access, d))
    : []

  // Sélection des 4 tabs primaires pour mobile : priorité aux items
  // workflow standard (home, dossiers, capture, calendar).
  const preferredIds: SidebarItemId[] = ['home', 'dossiers', 'capture', 'calendar']
  const tabDefs: SidebarItemDef[] = []
  for (const id of preferredIds) {
    const found = visibleMain.find((d) => d.id === id)
    if (found) tabDefs.push(found)
  }
  // Complète si moins de 4 (track free / annuaire-only ou items masqués)
  if (tabDefs.length < 4) {
    for (const def of visibleMain) {
      if (tabDefs.length >= 4) break
      if (!tabDefs.find((d) => d.id === def.id)) tabDefs.push(def)
    }
  }
  // Si toujours vide (track free), fallback minimal
  if (tabDefs.length === 0) {
    const homeDef = SIDEBAR_ITEMS_BY_ID.get('home')
    if (homeDef) tabDefs.push(homeDef)
  }

  const hasSuggestion = suggestions.length > 0
  const counts: SidebarBadgeCounts = badgeCounts ?? {
    active_dossiers: 0,
    overdue_invoices: 0,
    unread_messages: 0,
    unread_notifications: 0,
  }

  return (
    <>
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
        style={{ backgroundColor: NAVY_INK }}
        aria-label="Navigation mobile"
      >
        <div className="flex items-stretch">
          {tabDefs.map((def) => {
            const active = isActive(pathname, def.href)
            const Icon = def.icon
            const count = def.badgeKey ? counts[def.badgeKey] : 0
            return (
              <Link
                key={def.id}
                href={def.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors',
                )}
              >
                <span className="relative">
                  <Icon
                    className="size-[22px]"
                    strokeWidth={1.5}
                    style={{
                      color: active ? CHARTREUSE : 'rgba(255,255,255,0.65)',
                    }}
                  />
                  {count > 0 ? (
                    <span
                      aria-hidden
                      className="absolute -top-1 -right-2 min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center"
                      style={{ backgroundColor: CHARTREUSE, color: NAVY_INK }}
                    >
                      {count > 9 ? '9+' : count}
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    'font-mono text-[10px] leading-tight',
                    active ? 'font-semibold' : 'font-normal',
                  )}
                  style={{
                    color: active ? CHARTREUSE : 'rgba(255,255,255,0.65)',
                  }}
                >
                  {def.label}
                </span>
                {active ? (
                  <span
                    aria-hidden
                    className="absolute bottom-0.5 size-1 rounded-full"
                    style={{ backgroundColor: CHARTREUSE }}
                  />
                ) : null}
              </Link>
            )
          })}

          {/* 5e tab : Plus */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-controls="mobile-more-sheet"
            className={cn(
              'relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors',
            )}
          >
            <LayoutGrid
              className="size-[22px]"
              strokeWidth={1.5}
              style={{
                color: moreOpen ? CHARTREUSE : 'rgba(255,255,255,0.65)',
              }}
            />
            <span
              className={cn(
                'font-mono text-[10px] leading-tight',
                moreOpen ? 'font-semibold' : 'font-normal',
              )}
              style={{
                color: moreOpen ? CHARTREUSE : 'rgba(255,255,255,0.65)',
              }}
            >
              Plus
            </span>
            {hasSuggestion ? (
              <span
                aria-hidden
                className="absolute top-2 right-[calc(50%-14px)] size-1.5 rounded-full"
                style={{ backgroundColor: CHARTREUSE }}
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
