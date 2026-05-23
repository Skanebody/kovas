'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

/**
 * Navigation publique partagée — landing B2C (annuaire) et B2B (SaaS diagnostiqueurs).
 * - variant 'b2c' : fond cream, ton particuliers
 * - variant 'b2b' : fond sage, ton diagnostiqueurs (DS v5)
 */
export type PublicNavVariant = 'b2c' | 'b2b'

interface PublicNavProps {
  variant: PublicNavVariant
}

interface NavLink {
  href: string
  label: string
}

const LINKS_B2C: NavLink[] = [
  { href: '/trouver-un-diagnostiqueur', label: 'Trouver un diagnostiqueur' },
  { href: '/#how-it-works', label: 'Comment ça marche' },
  { href: '/#faq', label: 'Questions fréquentes' },
]

const LINKS_B2B: NavLink[] = [
  { href: '/pour-les-diagnostiqueurs#features', label: 'Logiciel' },
  { href: '/pricing', label: 'Tarifs' },
  { href: '/pour-les-diagnostiqueurs#video-demo', label: 'Démo' },
]

export function PublicNav({ variant }: PublicNavProps) {
  const [open, setOpen] = useState(false)
  const links = variant === 'b2c' ? LINKS_B2C : LINKS_B2B

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b backdrop-blur',
        variant === 'b2c'
          ? 'bg-cream/85 border-rule/60'
          : 'bg-sage/85 border-ink/10',
      )}
    >
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0"
          aria-label={variant === 'b2b' ? 'KOVAS 360 Accueil' : 'KOVAS Accueil'}
        >
          <span
            className={cn(
              'size-8 rounded-md',
              variant === 'b2c' ? 'bg-navy' : 'bg-[#0F1419]',
            )}
            aria-hidden
          />
          <span className="text-base font-bold tracking-tight">
            {variant === 'b2b' ? 'KOVAS 360' : 'KOVAS'}
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm" aria-label="Navigation principale">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-ink-mute hover:text-ink transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {variant === 'b2c' ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/pour-les-diagnostiqueurs">Pour les diagnostiqueurs</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/trouver-un-diagnostiqueur">Trouver un diagnostiqueur</Link>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/">Espace particuliers</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Connexion</Link>
              </Button>
              <Button size="sm" variant="accent" asChild>
                <Link href="/signup">Essai 30 jours</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center size-10 rounded-md hover:bg-ink/5"
          aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <div
          className={cn(
            'md:hidden border-t',
            variant === 'b2c' ? 'border-rule/60 bg-cream' : 'border-ink/10 bg-sage',
          )}
        >
          <div className="mx-auto max-w-7xl px-6 py-4 flex flex-col gap-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="py-2 text-base text-ink-mute hover:text-ink transition-colors"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <div className="flex flex-col gap-2 pt-3 border-t border-rule/40">
              {variant === 'b2c' ? (
                <>
                  <Button variant="outline" asChild>
                    <Link href="/pour-les-diagnostiqueurs">Pour les diagnostiqueurs</Link>
                  </Button>
                  <Button asChild>
                    <Link href="/trouver-un-diagnostiqueur">Trouver un diagnostiqueur</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" asChild>
                    <Link href="/">Espace particuliers</Link>
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link href="/login">Connexion</Link>
                  </Button>
                  <Button variant="accent" asChild>
                    <Link href="/signup">Essai 30 jours</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
