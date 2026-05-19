'use client'

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
 * Tabs pillules navigation primaire — header desktop.
 * cf. docs/design-system.md §2 (Tabs) + §3 (App shell).
 */
export function AppNavTabs() {
  const pathname = usePathname()

  return (
    <nav className="hidden md:flex items-center gap-1 rounded-pill bg-paper/85 backdrop-blur-xl border border-rule/60 p-1 shadow-glass-sm">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'rounded-pill px-4 py-1.5 text-sm transition-colors',
              active
                ? 'bg-navy text-paper font-semibold shadow-accent'
                : 'text-ink-mute hover:text-ink font-medium',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
