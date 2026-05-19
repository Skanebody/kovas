import { AppNavTabs } from '@/components/app-nav-tabs'
import { AppMobileNav, AppSidebar } from '@/components/app-sidebar'
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
    <div className="min-h-dvh flex flex-col">
      <header className="glass-header sticky top-0 z-50">
        <div className="px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/app/dashboard" className="flex items-center gap-2 shrink-0">
            <div className="size-8 rounded-md bg-cta shadow-cta" aria-hidden />
            <span className="text-base font-bold tracking-tight">KOVAS</span>
          </Link>
          <AppNavTabs />
          <div className="flex items-center gap-2 shrink-0">
            <CommandPaletteTrigger />
            <UsageWidget />
            <UserMenu displayName={displayName} email={profile.email} onLogout={logoutAction} />
          </div>
        </div>
      </header>
      <div className="flex-1 flex">
        <AppSidebar />
        <main className="flex-1 px-4 md:px-8 py-6 pb-20 md:pb-8 mx-auto w-full max-w-6xl">
          {children}
        </main>
      </div>
      <AppMobileNav />
      <CommandPalette />
    </div>
  )
}
