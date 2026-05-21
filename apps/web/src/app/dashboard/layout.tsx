import { AppNavTabs } from '@/components/app-nav-tabs'
import { AppMobileNav, AppSidebar } from '@/components/app-sidebar'
import { AppShell } from '@/components/app-shell'
import { CommandPalette } from '@/components/command-palette'
import { CommandPaletteTrigger } from '@/components/command-palette-trigger'
import { RegulatoryNotificationsBadge } from '@/components/regulatory/RegulatoryNotificationsBadge'
import { MobileQuickActionsFab } from '@/components/ui/mobile-quick-actions'
import { OfflineBanner } from '@/components/ui/offline-banner'
import { SyncIndicator } from '@/components/ui/sync-indicator'
import { UsageWidget } from '@/components/usage-widget'
import { UserMenu } from '@/components/user-menu'
import { getUserTrackAccess } from '@/lib/access/track-access'
import { getCurrentUser } from '@/lib/auth/current-user'
import { loadPendingSuggestions, loadUserAccess } from '@/lib/upsell/load-access'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { logoutAction } from './actions'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, profile, orgId, supabase } = await getCurrentUser()
  const displayName = profile.full_name ?? profile.email

  // L1 — Upsell intelligent : charge l'accès et les suggestions pending pour
  // la sidebar adaptive et le bouton "Découvrir" + dot chartreuse.
  // Phase C — Dual track : charge également l'état Annuaire/Logiciel pour
  // adapter la sidebar (annuaire-only / logiciel-only / dual / free).
  const [access, suggestions, trackAccess] = await Promise.all([
    loadUserAccess(supabase, orgId),
    loadPendingSuggestions(supabase, user.id),
    getUserTrackAccess(),
  ])

  return (
    <AppShell background="light" className="min-h-dvh flex">
      <AppSidebar access={access} suggestions={suggestions} track={trackAccess.track} />

      <div className="flex-1 flex flex-col min-w-0">
        <OfflineBanner />
        {/* Header app v4 — sans logo (déjà dans sidebar 240px), juste search + usage + user */}
        <header className="md:sticky top-0 z-30 px-4 md:px-6 pt-4 pb-2 bg-transparent">
          <div className="glass-opaque rounded-pill px-3 py-2 flex items-center justify-between gap-3">
            {/* Mobile only : logo + nav tabs */}
            <Link
              href="/dashboard/dashboard"
              className="md:hidden flex items-center gap-2 shrink-0 pl-1"
            >
              <div
                aria-hidden
                className="size-8 rounded-md bg-navy shadow-accent flex items-center justify-center text-white font-bold text-xs"
              >
                K
              </div>
            </Link>
            <AppNavTabs />
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              <SyncIndicator organizationId={orgId} />
              <CommandPaletteTrigger />
              <UsageWidget />
              <RegulatoryNotificationsBadge />
              <UserMenu displayName={displayName} email={profile.email} onLogout={logoutAction} />
            </div>
          </div>
        </header>

        {/*
          Cap global largeur à 1280px (max-w-7xl) + centré (mx-auto) pour éviter
          que les formulaires/cards s'étirent grotesquement sur écrans >1800px.
          Pages avec tables/grids dense peuvent override via `max-w-none` sur
          leur container racine si elles ont besoin de la pleine largeur.
        */}
        <main className="flex-1 px-4 md:px-8 py-4 pb-24 md:pb-8 w-full max-w-7xl mx-auto min-w-0">
          {children}
        </main>
      </div>

      <AppMobileNav access={access} suggestions={suggestions} track={trackAccess.track} />
      <MobileQuickActionsFab />
      <CommandPalette />
    </AppShell>
  )
}
