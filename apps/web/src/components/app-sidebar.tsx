'use client'

import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'
import { Building2, FileText, Home, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

const NAV: readonly NavItem[] = [
  { href: '/app/dashboard', label: 'Tableau de bord', icon: Home },
  { href: '/app/dossiers', label: 'Dossiers', icon: FileText },
  { href: '/app/clients', label: 'Clients', icon: Users },
  { href: '/app/properties', label: 'Biens', icon: Building2 },
] as const

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false
  if (href === '/app/dashboard') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Sidebar verticale étroite (64px) — desktop.
 * Icônes seules avec tooltip natif. Theme toggle en bas.
 * cf. docs/design-system.md §3 + CLAUDE.md §9.
 */
export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-16 shrink-0 flex-col items-center glass-sidebar py-4 sticky top-16 self-start h-[calc(100dvh-4rem)]">
      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              title={item.label}
              className={cn(
                'flex size-10 items-center justify-center rounded-md transition-colors',
                active
                  ? 'bg-cta/[0.08] text-cta'
                  : 'text-ink-mute hover:bg-cta/[0.04] hover:text-foreground',
              )}
            >
              <item.icon className="size-5" strokeWidth={1.75} />
            </Link>
          )
        })}
      </nav>
      <ThemeToggle />
    </aside>
  )
}

/**
 * Bottom-nav mobile (< md). Icônes + label court.
 * Desktop : la navigation primaire passe aussi par <AppNavTabs /> dans le header.
 */
export function AppMobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 glass-header border-t">
      <div className="flex">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2.5 text-xs transition-colors',
                active ? 'text-cta font-semibold' : 'text-ink-mute',
              )}
            >
              <item.icon className="size-5" strokeWidth={1.75} />
              <span>{item.label.split(' ')[0]}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
