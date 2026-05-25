'use client'

import { cn } from '@/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Sous-navigation sticky sous l'AppHeader public, dédiée à l'espace
 * `/pros` (B2B diagnostiqueurs). Mobile : scroll horizontal sans wrap.
 * Desktop : ligne unique centrée.
 *
 * Avatar référent : diagnostiqueur 43 ans, ex-cadre. Ton SOBRE PROFESSIONNEL.
 */
const PROS_NAV_LINKS = [
  { href: '/pros', label: 'Accueil' },
  { href: '/fonctionnalites', label: 'Fonctionnalités' },
  { href: '/tarifs', label: 'Tarifs' },
  { href: '/temoignages', label: 'Témoignages' },
  { href: '/comparatif', label: 'Comparatif' },
  { href: '/demo', label: 'Démo' },
  { href: '/api-publique', label: 'API' },
] as const

export function ProsNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navigation espace diagnostiqueurs"
      className="sticky top-16 z-40 border-b border-rule/50 bg-paper/95 backdrop-blur-xl"
    >
      <div className="mx-auto max-w-6xl">
        <ul className="flex items-center gap-1 overflow-x-auto px-4 py-2 text-sm scrollbar-none">
          {PROS_NAV_LINKS.map((link) => {
            const isActive =
              link.href === '/pros'
                ? pathname === '/pros'
                : pathname === link.href || pathname.startsWith(`${link.href}/`)
            return (
              <li key={link.href} className="shrink-0">
                <Link
                  href={link.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'inline-flex items-center rounded-pill px-3.5 py-1.5 font-medium transition-colors',
                    isActive ? 'bg-navy text-paper' : 'text-ink-mute hover:bg-ink/5 hover:text-ink',
                  )}
                >
                  {link.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
