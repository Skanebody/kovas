'use client'

import { Building2, FileText, Home, Users } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/app/dashboard', label: 'Tableau de bord', icon: Home },
  { href: '/app/missions', label: 'Missions', icon: FileText },
  { href: '/app/clients', label: 'Clients', icon: Users },
  { href: '/app/properties', label: 'Biens', icon: Building2 },
] as const

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-border bg-card/40">
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/app/dashboard' && pathname?.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-muted text-foreground font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}

export function AppMobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/90 backdrop-blur-md">
      <div className="flex">
        {NAV.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/app/dashboard' && pathname?.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <item.icon className="size-5" />
              <span>{item.label.split(' ')[0]}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
