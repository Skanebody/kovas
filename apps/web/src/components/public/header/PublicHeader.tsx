/**
 * KOVAS — Header public marketing partagé.
 *
 * Sticky, transparent sur background sage, glass léger au scroll.
 * Utilisé sur la home, /faq, /trouver-un-diagnostiqueur, /pros/* et toutes les
 * pages institutionnelles (a-propos, presse, carrieres, partenaires).
 *
 * Brand V5 strict : sage background + navy ink + chartreuse CTA accent.
 *
 * Audit FIX-AUDIT-2 (2026-05-23) : ajout du dropdown "Guides" listant
 * les 9 guides longs SEO (DPE, amiante, plomb, gaz, électricité,
 * termites, carrez, ERP, audit). Hover-open sur desktop, accordion
 * sur mobile via Disclosure native <details>.
 */

import { Button } from '@/components/ui/button'
import { GUIDES_LIST } from '@/lib/guides/registry'
import { ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { MobileMenu } from './MobileMenu'

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 bg-background/85 backdrop-blur-md border-b border-rule/60">
      {/*
        Fix tablet overflow (2026-05-27) : le breakpoint md (768px) faisait
        déborder le header (logo 120 + nav 470 + CTAs 170 + padding 48 = ~808 px
        pour 768 px de viewport). Solution :
          - md (768-1023px) : nav avec gap réduit + labels plus courts via classes
            `md:hidden lg:inline` sur les mots optionnels + CTA "Se connecter"
            masqué (laisse juste l'accent CTA "Essai 30j")
          - lg+ (≥1024px) : nav complète + les 2 CTAs visibles
      */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8 lg:px-12 h-16 flex items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span className="size-8 rounded-md bg-ink" aria-hidden />
          <span className="text-base font-bold tracking-tight text-ink">KOVAS</span>
        </Link>
        <nav
          className="hidden md:flex items-center gap-3 lg:gap-7 text-sm min-w-0"
          aria-label="Navigation principale"
        >
          <Link
            href="/calculateur-dpe-gratuit"
            className="text-ink-mute hover:text-ink transition-colors whitespace-nowrap"
          >
            Calculateur<span className="hidden lg:inline"> DPE</span>
          </Link>
          <Link
            href="/trouver-un-diagnostiqueur"
            className="text-ink-mute hover:text-ink transition-colors whitespace-nowrap"
          >
            <span className="lg:hidden">Annuaire</span>
            <span className="hidden lg:inline">Trouver un diagnostiqueur</span>
          </Link>
          <Link
            href="/observatoire"
            className="text-ink-mute hover:text-ink transition-colors whitespace-nowrap"
          >
            Observatoire
          </Link>
          <GuidesMenu />
          <Link
            href="/pros"
            className="text-ink-mute hover:text-ink transition-colors whitespace-nowrap"
          >
            <span className="lg:hidden">Pros</span>
            <span className="hidden lg:inline">Pour diagnostiqueurs</span>
          </Link>
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          {/* "Se connecter" masqué entre md (768) et lg (1024) pour éviter overflow,
              re-apparaît dès lg+. Sur mobile (&lt; md) il reste visible — le header
              n'a pas la nav donc l'espace est libre. */}
          <Button variant="ghost" size="sm" asChild className="hidden lg:inline-flex">
            <Link href="/login">Se connecter</Link>
          </Button>
          <Button size="sm" variant="accent" asChild>
            <Link href="/signup">Essai 30j</Link>
          </Button>
          <MobileMenu />
        </div>
      </div>
    </header>
  )
}

/**
 * Dropdown "Guides" — desktop hover, accessibility-friendly.
 *
 * Pattern CSS-only via group-hover + focus-within : pas de JS state,
 * fonctionne sans hydratation. Au focus clavier, le menu reste ouvert
 * tant qu'un descendant est focus.
 */
function GuidesMenu() {
  return (
    <div className="relative group">
      <Link
        href="/guide"
        className="inline-flex items-center gap-1 text-ink-mute hover:text-ink transition-colors focus-visible:outline-none focus-visible:text-ink"
        aria-haspopup="true"
      >
        Guides
        <ChevronDown
          className="size-3.5 transition-transform group-hover:rotate-180"
          aria-hidden
        />
      </Link>
      <div
        className="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 absolute left-1/2 -translate-x-1/2 top-full pt-3 transition-opacity duration-150 z-50"
        role="menu"
      >
        <div className="w-72 rounded-2xl bg-paper shadow-glass-lg border border-rule/40 p-2">
          <Link
            href="/guide"
            role="menuitem"
            className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-ink hover:bg-background transition-colors"
          >
            Tous les guides
            <span className="block text-xs font-normal text-ink-mute mt-0.5">
              {GUIDES_LIST.length} guides longs pour propriétaires
            </span>
          </Link>
          <div className="h-px bg-rule/40 my-1.5" />
          <ul className="grid grid-cols-1 gap-px">
            {GUIDES_LIST.map((guide) => (
              <li key={guide.slug}>
                <Link
                  href={`/guide/${guide.slug}`}
                  role="menuitem"
                  className="block rounded-lg px-3 py-2 text-sm text-ink-mute hover:bg-background hover:text-ink transition-colors"
                >
                  Guide {guide.shortTitle}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
