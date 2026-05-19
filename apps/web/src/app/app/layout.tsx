import { AppNavTabs } from '@/components/app-nav-tabs'
import { AppMobileNav, AppSidebar } from '@/components/app-sidebar'
import { AppShell } from '@/components/app-shell'
import { CommandPalette } from '@/components/command-palette'
import { CommandPaletteTrigger } from '@/components/command-palette-trigger'
import { UsageWidget } from '@/components/usage-widget'
import { UserMenu } from '@/components/user-menu'
import { getCurrentUser } from '@/lib/auth/current-user'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { logoutAction } from './actions'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { profile } = await getCurrentUser()
  const displayName = profile.full_name ?? profile.email

  return (
    <AppShell background="light" className="min-h-dvh flex">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header app v4 — sans logo (déjà dans sidebar 240px), juste search + usage + user */}
        <header className="md:sticky top-0 z-30 px-4 md:px-6 pt-4 pb-2 bg-transparent">
          <div className="glass-opaque rounded-pill px-3 py-2 flex items-center justify-between gap-3">
            {/* Mobile only : logo + nav tabs */}
            <Link
              href="/app/dashboard"
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
              <CommandPaletteTrigger />
              <UsageWidget />
              <UserMenu displayName={displayName} email={profile.email} onLogout={logoutAction} />
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-8 py-4 pb-24 md:pb-8 w-full min-w-0">{children}</main>
      </div>

      <AppMobileNav />
      <CommandPalette />
    </AppShell>
  )
}
