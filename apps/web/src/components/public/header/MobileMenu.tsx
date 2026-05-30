'use client'

/**
 * KOVAS — Menu de navigation mobile (header public).
 *
 * La nav desktop est en `hidden md:flex` : sous 768px elle disparaissait sans
 * remplacement → impossible d'atteindre Annuaire / Observatoire / Guides / Pros.
 * Ce composant ajoute le bouton hamburger (md:hidden) + un panneau dépliant.
 *
 * Client component (useState) pour fermer le panneau au clic sur un lien et au
 * clic sur l'overlay. Brand V5 : paper + navy ink + accent chartreuse sur le CTA.
 */

import { Button } from '@/components/ui/button'
import { Menu, X } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

const NAV_LINKS = [
  { href: '/calculateur-dpe-gratuit', label: 'Calculateur DPE gratuit' },
  { href: '/trouver-un-diagnostiqueur', label: 'Trouver un diagnostiqueur' },
  { href: '/observatoire', label: 'Observatoire du DPE' },
  { href: '/guide', label: 'Guides' },
  { href: '/garantie', label: 'Garantie' },
  { href: '/pros', label: 'Pour les diagnostiqueurs' },
] as const

export function MobileMenu() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={open}
        className="inline-flex items-center justify-center size-10 rounded-md text-ink hover:bg-ink/[0.05] transition-colors"
      >
        {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
      </button>

      {open ? (
        <>
          {/* Overlay pour fermer au clic en dehors */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={close}
            className="fixed inset-x-0 bottom-0 top-16 z-40 bg-ink/20 cursor-default"
          />
          <nav
            className="absolute inset-x-0 top-16 z-50 bg-paper border-b border-rule/60 shadow-glass-lg"
            aria-label="Navigation mobile"
          >
            <ul className="px-4 py-3 max-h-[calc(100dvh-4rem)] overflow-y-auto">
              {NAV_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    onClick={close}
                    className="block rounded-lg px-3 py-3 text-[15px] text-ink hover:bg-background transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li className="mt-2 pt-3 border-t border-rule/40 flex flex-col gap-2">
                <Button variant="outline" asChild className="w-full">
                  <Link href="/login" onClick={close}>
                    Se connecter
                  </Link>
                </Button>
                <Button variant="accent" asChild className="w-full">
                  <Link href="/signup" onClick={close}>
                    Démarrer l&apos;essai 30 jours
                  </Link>
                </Button>
              </li>
            </ul>
          </nav>
        </>
      ) : null}
    </div>
  )
}
