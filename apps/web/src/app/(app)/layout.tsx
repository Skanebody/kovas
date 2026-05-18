import { LogOut } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { AppMobileNav, AppSidebar } from '@/components/app-sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { logoutAction } from './actions'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { profile } = await getCurrentUser()
  const displayName = profile.full_name ?? profile.email

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="px-4 md:px-6 h-14 flex items-center justify-between gap-4">
          <Link href="/app/dashboard" className="flex items-center gap-2">
            <div className="size-7 rounded-md bg-cta" aria-hidden />
            <span className="text-base font-semibold tracking-tight">KOVAS</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="text-sm text-muted-foreground hidden lg:inline ml-2">
              {displayName}
            </span>
            <Avatar name={displayName} size="sm" />
            <form action={logoutAction}>
              <Button variant="ghost" size="icon" type="submit" aria-label="Se déconnecter">
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>
      <div className="flex-1 flex">
        <AppSidebar />
        <main className="flex-1 px-4 md:px-8 py-6 pb-20 md:pb-8 max-w-6xl">{children}</main>
      </div>
      <AppMobileNav />
    </div>
  )
}
