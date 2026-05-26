import { AppNavTabs } from '@/components/app-nav-tabs'
import { AppShell } from '@/components/app-shell'
import { AppMobileNav, AppSidebar } from '@/components/app-sidebar'
import { TrialBannerLoader } from '@/components/billing/TrialBannerLoader'
import { CommandPalette } from '@/components/command-palette'
import { CommandPaletteTrigger } from '@/components/command-palette-trigger'
import { MissionFabMobile } from '@/components/mission/MissionFabMobile'
import { RegulatoryNotificationsBadge } from '@/components/regulatory/RegulatoryNotificationsBadge'
import { CommandK } from '@/components/shared/CommandK'
import { MobileQuickActionsFab } from '@/components/ui/mobile-quick-actions'
import { OfflineBanner } from '@/components/ui/offline-banner'
import { SyncIndicator } from '@/components/ui/sync-indicator'
import { UsageWidget } from '@/components/usage-widget'
import { UserMenu } from '@/components/user-menu'
import { getUserTrackAccess } from '@/lib/access/track-access'
import { getCurrentUser } from '@/lib/auth/current-user'
import { checkTrialGuard, isPathWhitelisted } from '@/lib/billing/trial-guard'
import { saveSidebarPreferencesAction } from '@/lib/sidebar/actions'
import { loadSidebarBadgeCounts } from '@/lib/sidebar/badge-counts'
import { loadSidebarPreferences } from '@/lib/sidebar/preferences-server'
import { loadPendingSuggestions, loadUserAccess } from '@/lib/upsell/load-access'
import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { logoutAction } from './actions'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { user, profile, orgId, supabase } = await getCurrentUser()
  const displayName = profile.full_name ?? profile.email

  // L1 — Upsell intelligent : charge l'accès et les suggestions pending pour
  // la sidebar adaptive et le bouton "Découvrir" + dot chartreuse.
  // Phase C — Dual track : charge également l'état Annuaire/Logiciel pour
  // adapter la sidebar (annuaire-only / logiciel-only / dual / free).
  // FIX-CC (2026-05-23) : charge les préférences sidebar + compteurs badges.
  const [access, suggestions, trackAccess, trialVerdict, sidebarPrefs, badgeCounts] =
    await Promise.all([
      loadUserAccess(supabase, orgId),
      loadPendingSuggestions(supabase, user.id),
      getUserTrackAccess(),
      checkTrialGuard(supabase, orgId),
      loadSidebarPreferences(user.id, supabase),
      loadSidebarBadgeCounts(supabase, orgId),
    ])

  // Garde "essai expiré sans paiement" — redirige vers /dashboard/account?expired=1
  // sauf si déjà sur une route whitelistée (account, billing, API, status, etc.).
  if (trialVerdict.kind === 'expired') {
    const h = await headers()
    const pathname = h.get('x-invoke-path') ?? h.get('referer') ?? ''
    const currentPath = pathname.startsWith('/dashboard') ? pathname : '/dashboard'
    if (!isPathWhitelisted(currentPath)) {
      redirect('/dashboard/account?expired=1')
    }
  }

  return (
    <AppShell background="light" className="min-h-dvh flex">
      <AppSidebar
        access={access}
        suggestions={suggestions}
        track={trackAccess.track}
        preferences={sidebarPrefs}
        badgeCounts={badgeCounts}
        user={{
          id: user.id,
          displayName: displayName ?? profile.email,
          email: profile.email,
          avatarUrl: null,
        }}
        onLogout={logoutAction}
        saveAction={saveSidebarPreferencesAction}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <OfflineBanner />
        <TrialBannerLoader />
        {/* Header app V5 sobre — paper opaque + bordure fine 8%, sans glass/blur (Lot B78) */}
        <header className="md:sticky top-0 z-30 px-4 md:px-6 pt-4 pb-2 bg-transparent">
          <div className="bg-paper rounded-2xl border border-[#0F1419]/[0.08] px-3 py-2 flex items-center justify-between gap-3">
            {/* Mobile only : logo + nav tabs */}
            <Link
              href="/dashboard/dashboard"
              className="md:hidden flex items-center gap-2 shrink-0 pl-1"
            >
              <div
                aria-hidden
                className="size-8 rounded-md bg-[#0F1419] flex items-center justify-center text-white font-bold text-xs"
              >
                K
              </div>
            </Link>
            <AppNavTabs access={access} />
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

      <AppMobileNav
        access={access}
        suggestions={suggestions}
        track={trackAccess.track}
        preferences={sidebarPrefs}
        badgeCounts={badgeCounts}
      />
      <MobileQuickActionsFab />
      {/* FIX-JJ multi-accès #5 — FAB mission dédié, bottom-right mobile */}
      <MissionFabMobile />
      {/* Palette riche (Cmd+K, dossiers/clients/biens/récents) — listener Cmd+K interne. */}
      <CommandPalette />
      {/* Palette légère CommandK — montée pour API future ; raccourci désactivé
          pour ne pas entrer en conflit avec CommandPalette ci-dessus.
          Ouverture possible via prop ou store dédié plus tard. */}
      <CommandK enableShortcut={false} />
    </AppShell>
  )
}
