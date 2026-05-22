import { cn } from '@/lib/utils'
import Link from 'next/link'
import type { ReactNode } from 'react'

type FooterLink = { label: string; href: string }
type FooterCity = { city: string; dept: string; slug: string }

const PARTICULIERS: readonly FooterLink[] = [
  { label: 'Calculateur DPE gratuit', href: '/calculateur-dpe-gratuit' },
  { label: 'Annuaire diagnostiqueurs', href: '/diagnostiqueurs' },
  { label: 'Guides', href: '/guides' },
  { label: 'Observatoire', href: '/observatoire' },
  { label: 'FAQ particuliers', href: '/faq' },
] as const

const PROS: readonly FooterLink[] = [
  { label: 'Fonctionnalités', href: '/pros' },
  { label: 'Tarifs', href: '/pros/tarifs' },
  { label: 'Témoignages', href: '/pros/temoignages' },
  { label: 'Comparatif vs Liciel et OBBC', href: '/pros/comparatif' },
  { label: 'Démo', href: '/pros/demo' },
  { label: 'API', href: '/pros/api' },
  { label: "Centre d'aide", href: '/pros/aide' },
] as const

const DIAGNOSTICS: readonly FooterLink[] = [
  { label: 'DPE', href: '/guide/dpe' },
  { label: 'Amiante', href: '/guide/amiante' },
  { label: 'Plomb CREP', href: '/guide/plomb' },
  { label: 'Gaz', href: '/guide/gaz' },
  { label: 'Électricité', href: '/guide/electricite' },
  { label: 'Termites', href: '/guide/termites' },
  { label: 'Carrez / Boutin', href: '/guide/carrez' },
  { label: 'ERP', href: '/guide/erp' },
  { label: 'Audit énergétique', href: '/guide/audit-energetique' },
] as const

const VILLES: readonly FooterCity[] = [
  { city: 'Paris', dept: '75', slug: 'paris' },
  { city: 'Lyon', dept: '69', slug: 'lyon' },
  { city: 'Marseille', dept: '13', slug: 'marseille' },
  { city: 'Toulouse', dept: '31', slug: 'toulouse' },
  { city: 'Bordeaux', dept: '33', slug: 'bordeaux' },
  { city: 'Lille', dept: '59', slug: 'lille' },
  { city: 'Nantes', dept: '44', slug: 'nantes' },
  { city: 'Strasbourg', dept: '67', slug: 'strasbourg' },
  { city: 'Montpellier', dept: '34', slug: 'montpellier' },
  { city: 'Rennes', dept: '35', slug: 'rennes' },
  { city: 'Nice', dept: '06', slug: 'nice' },
  { city: 'Grenoble', dept: '38', slug: 'grenoble' },
  { city: 'Dieppe', dept: '76', slug: 'dieppe' },
  { city: 'Rouen', dept: '76', slug: 'rouen' },
  { city: 'Le Havre', dept: '76', slug: 'le-havre' },
  { city: 'Reims', dept: '51', slug: 'reims' },
  { city: 'Toulon', dept: '83', slug: 'toulon' },
  { city: 'Saint-Étienne', dept: '42', slug: 'saint-etienne' },
  { city: 'Angers', dept: '49', slug: 'angers' },
  { city: 'Brest', dept: '29', slug: 'brest' },
  { city: 'Limoges', dept: '87', slug: 'limoges' },
  { city: 'Tours', dept: '37', slug: 'tours' },
  { city: 'Amiens', dept: '80', slug: 'amiens' },
  { city: 'Perpignan', dept: '66', slug: 'perpignan' },
  { city: 'Metz', dept: '57', slug: 'metz' },
  { city: 'Besançon', dept: '25', slug: 'besancon' },
  { city: 'Orléans', dept: '45', slug: 'orleans' },
  { city: 'Mulhouse', dept: '68', slug: 'mulhouse' },
  { city: 'Caen', dept: '14', slug: 'caen' },
  { city: 'Nancy', dept: '54', slug: 'nancy' },
] as const

const ENTREPRISE: readonly FooterLink[] = [
  { label: 'À propos', href: '/a-propos' },
  { label: 'Contact', href: '/contact' },
  { label: 'Carrières', href: '/carrieres' },
  { label: 'Presse', href: '/presse' },
  { label: 'Blog', href: '/conseils' },
] as const

const ENTREPRISE_LEGAL: readonly FooterLink[] = [
  { label: 'Mentions légales', href: '/mentions-legales' },
  { label: 'CGV', href: '/cgv' },
  { label: 'CGU', href: '/cgu' },
  { label: 'Confidentialité', href: '/confidentialite' },
  { label: 'Cookies', href: '/cookies' },
] as const

type SiteFooterProps = {
  className?: string
}

/**
 * Pied de page marketing kovas.fr — 6 colonnes desktop, 3 cols tablet, 1 col accordéon mobile.
 * Marque + Particuliers + Diagnostiqueurs + Diagnostics + Villes + Entreprise.
 */
export function SiteFooter({ className }: SiteFooterProps) {
  return (
    <footer
      className={cn(
        'bg-paper border-t border-rule px-4 sm:px-6 md:px-8 lg:px-12 py-14 md:py-20',
        className,
      )}
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-10">
          {/* Col 1 — Marque */}
          <div className="space-y-5 lg:col-span-1 md:col-span-3 lg:row-span-1">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="size-8 rounded-md bg-ink" aria-hidden />
              <span className="font-sans font-bold text-lg tracking-tight text-ink">KOVAS</span>
            </Link>
            <p className="text-sm text-ink-mute leading-relaxed">
              Le diagnostic immobilier moderne.
            </p>
            <SocialLinks />
            <p className="text-xs font-mono uppercase tracking-wider text-ink-faint pt-2">
              Made in France <span aria-hidden>🇫🇷</span>
            </p>
          </div>

          <FooterColumn title="Particuliers" links={PARTICULIERS} />
          <FooterColumn title="Diagnostiqueurs" links={PROS} />
          <FooterColumn title="Diagnostics" links={DIAGNOSTICS} />
          <FooterColumn
            title="Villes"
            links={VILLES.map((v) => ({
              label: v.city,
              href: `/diagnostiqueurs/${v.dept}/${v.slug}`,
            }))}
            compact
          />
          <FooterColumn title="Entreprise" links={ENTREPRISE} legalLinks={ENTREPRISE_LEGAL} />
        </div>

        {/* Sous-footer fin */}
        <div className="mt-14 pt-8 border-t border-rule">
          <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between text-xs text-ink-faint">
            <p>
              © {new Date().getFullYear()} SASU Nexus 1993 · 66 av. des Champs-Élysées, 75008 Paris
              · SIREN 982 786 154
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/cookies" className="hover:text-ink transition-colors">
                Gérer les cookies
              </Link>
              <LanguageSelector />
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

type FooterColumnProps = {
  title: string
  links: readonly FooterLink[]
  legalLinks?: readonly FooterLink[]
  compact?: boolean
}

/**
 * Colonne footer responsive : titre + liste de liens.
 * Mobile : <details> natif accordéon. Tablet/Desktop : ouverte par défaut.
 */
function FooterColumn({ title, links, legalLinks, compact = false }: FooterColumnProps) {
  return (
    <details className="md:open group" open>
      <summary className="md:cursor-default md:list-none md:pointer-events-none flex items-center justify-between cursor-pointer list-none">
        <h3 className="font-mono text-xs uppercase tracking-wider text-ink font-medium">{title}</h3>
        <span
          aria-hidden
          className="md:hidden text-ink-faint transition-transform group-open:rotate-180"
        >
          ▾
        </span>
      </summary>
      <ul
        className={cn(
          'mt-4 space-y-2.5',
          compact && 'grid grid-cols-2 gap-x-3 gap-y-2.5 space-y-0',
        )}
      >
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-sm text-ink-mute hover:text-ink transition-colors">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
      {legalLinks && legalLinks.length > 0 ? (
        <ul className="mt-5 pt-4 border-t border-rule space-y-2.5">
          {legalLinks.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="text-xs text-ink-faint hover:text-ink transition-colors"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  )
}

function SocialLinks(): ReactNode {
  const socials = [
    {
      name: 'LinkedIn',
      href: 'https://linkedin.com/company/kovas-app',
      svg: (
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="currentColor"
          role="img"
          aria-label="LinkedIn"
        >
          <title>LinkedIn</title>
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14ZM8.339 18.337v-8.59H5.667v8.59h2.672ZM7.003 8.574a1.548 1.548 0 1 0 0-3.096 1.548 1.548 0 0 0 0 3.096Zm11.335 9.763V13.59c0-2.396-1.279-3.511-2.984-3.511-1.377 0-1.993.756-2.337 1.288v-1.106h-2.594c.034.748 0 7.969 0 7.969h2.594v-4.61c0-.232.017-.466.085-.633.187-.467.612-.95 1.327-.95.937 0 1.312.713 1.312 1.76v4.433h2.597Z" />
        </svg>
      ),
    },
    {
      name: 'X',
      href: 'https://x.com/kovas_app',
      svg: (
        <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" role="img" aria-label="X">
          <title>X (Twitter)</title>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
        </svg>
      ),
    },
    {
      name: 'YouTube',
      href: 'https://youtube.com/@kovas-app',
      svg: (
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="currentColor"
          role="img"
          aria-label="YouTube"
        >
          <title>YouTube</title>
          <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.545 15.568V8.432L15.818 12l-6.273 3.568Z" />
        </svg>
      ),
    },
  ] as const

  return (
    <ul className="flex items-center gap-3">
      {socials.map((s) => (
        <li key={s.name}>
          <a
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={s.name}
            className="size-8 rounded-md border border-rule flex items-center justify-center text-ink-mute hover:text-ink hover:bg-sage transition-colors"
          >
            {s.svg}
          </a>
        </li>
      ))}
    </ul>
  )
}

/** Sélecteur langue préparé i18n (FR seul actif Phase 1). */
function LanguageSelector() {
  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">Langue</span>
      <select
        defaultValue="fr"
        aria-label="Sélectionner la langue"
        className="bg-transparent text-ink-faint hover:text-ink transition-colors text-xs border border-rule rounded-sm px-2 py-1 cursor-pointer"
        // FR seul actif Phase 1 — EN désactivé visuellement
      >
        <option value="fr">Français</option>
        <option value="en" disabled>
          English (bientôt)
        </option>
      </select>
    </label>
  )
}
