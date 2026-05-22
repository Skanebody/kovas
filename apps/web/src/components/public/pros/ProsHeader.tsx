import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'
import Link from 'next/link'

/**
 * Header public utilisé sur les pages `/pros/*`. Dropdown
 * « Pour les diagnostiqueurs » au hover, animation 150ms.
 *
 * Le dropdown est réalisé avec `<details>` natif pour rester
 * server-component compatible, sans JS supplémentaire.
 */
const PROS_DROPDOWN_LINKS = [
  { href: '/pros/fonctionnalites', label: 'Fonctionnalités' },
  { href: '/pros/tarifs', label: 'Tarifs' },
  { href: '/pros/temoignages', label: 'Témoignages' },
  { href: '/pros/comparatif', label: 'Comparatif' },
  { href: '/pros/api', label: 'API' },
] as const

export function ProsHeader() {
  return (
    <header className="sticky top-0 z-50 glass-header">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="size-8 rounded-md bg-navy shadow-accent" aria-hidden />
          <span className="text-base font-bold tracking-tight">KOVAS</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm sm:flex" aria-label="Principale">
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 text-ink-mute transition-colors duration-fast hover:text-ink [&::-webkit-details-marker]:hidden">
              Pour les diagnostiqueurs
              <ChevronDown
                className="size-3.5 transition-transform duration-fast group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div
              className="absolute left-0 top-full z-50 mt-2 min-w-[200px] rounded-lg border border-rule/60 bg-paper p-2 shadow-md"
              role="menu"
            >
              {PROS_DROPDOWN_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  role="menuitem"
                  className="block rounded-md px-3 py-2 text-sm text-ink-mute hover:bg-ink/5 hover:text-ink"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </details>
          <Link href="/pricing" className="text-ink-mute transition-colors hover:text-ink">
            Tarifs
          </Link>
          <Link href="/faq" className="text-ink-mute transition-colors hover:text-ink">
            FAQ
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Se connecter</Link>
          </Button>
          <Button size="sm" variant="accent" asChild>
            <Link href="/signup">Essai 30 jours</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
