import { LogOut } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import { logoutAction } from './actions'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  const displayName = profile?.full_name ?? profile?.email ?? user.email ?? ''

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <Link href="/app/dashboard" className="text-base font-semibold tracking-tight">
            KOVAS
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <span className="text-sm text-muted-foreground hidden sm:inline ml-2">
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
      <main className="flex-1 mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </div>
  )
}
