/**
 * KOVAS — Header public marketing partagé.
 *
 * Sticky, transparent sur background sage, glass léger au scroll.
 * Utilisé sur la home, /faq, /diagnostiqueurs, /pros/* et toutes les
 * pages institutionnelles (a-propos, presse, carrieres, partenaires).
 *
 * Brand V5 strict : sage background + navy ink + chartreuse CTA accent.
 */

import { Button } from '@/components/ui/button'
import Link from 'next/link'

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-rule/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8 lg:px-12 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="size-8 rounded-md bg-ink" aria-hidden />
          <span className="text-base font-bold tracking-tight text-ink">KOVAS</span>
        </Link>
        <nav
          className="hidden md:flex items-center gap-7 text-sm"
          aria-label="Navigation principale"
        >
          <Link
            href="/calculateur-dpe-gratuit"
            className="text-ink-mute hover:text-ink transition-colors"
          >
            Calculateur DPE
          </Link>
          <Link href="/diagnostiqueurs" className="text-ink-mute hover:text-ink transition-colors">
            Annuaire
          </Link>
          <Link href="/observatoire" className="text-ink-mute hover:text-ink transition-colors">
            Observatoire
          </Link>
          <Link href="/pros" className="text-ink-mute hover:text-ink transition-colors">
            Pour diagnostiqueurs
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Se connecter</Link>
          </Button>
          <Button size="sm" variant="accent" asChild>
            <Link href="/signup">Essai 30j</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
