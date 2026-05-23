import { cn } from '@/lib/utils'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'
import { Linkedin, Twitter } from 'lucide-react'
import Link from 'next/link'

/**
 * Pied de page public partagé (B2C / B2B).
 * 4 colonnes : Brand · KOVAS Annuaire (particuliers) · KOVAS 360 (diagnostiqueurs) · KOVAS (société)
 */
interface PublicFooterProps {
  variant?: 'b2c' | 'b2b'
}

interface FooterLink {
  href: string
  label: string
}

const LINKS_PARTICULIERS: FooterLink[] = [
  { href: '/trouver-un-diagnostiqueur', label: 'Annuaire diagnostiqueurs' },
  { href: '/#how-it-works', label: 'Comment ça marche' },
  { href: '/#faq', label: 'Questions fréquentes' },
  { href: '/trouver-un-diagnostiqueur', label: 'Demander un devis' },
]

const LINKS_DIAGNOSTIQUEURS: FooterLink[] = [
  { href: '/pour-les-diagnostiqueurs', label: 'Découvrir KOVAS 360' },
  { href: '/pricing', label: 'Tarifs' },
  { href: '/trouver-un-diagnostiqueur/reclamer', label: 'Réclamer ma fiche' },
  { href: '/login', label: 'Connexion' },
]

const LINKS_KOVAS: FooterLink[] = [
  { href: '/qui-sommes-nous', label: 'Qui sommes-nous' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
  { href: '/mentions-legales', label: 'Mentions légales' },
  { href: '/cgu', label: 'CGU' },
  { href: '/cgv', label: 'CGV' },
  { href: '/confidentialite', label: 'Politique RGPD' },
]

export function PublicFooter({ variant = 'b2c' }: PublicFooterProps) {
  return (
    <footer
      className={cn(
        'border-t mt-20',
        variant === 'b2c' ? 'bg-cream border-rule/60' : 'bg-sage border-ink/10',
      )}
    >
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 md:gap-8">
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2" aria-label="KOVAS Accueil">
              <span
                className={cn(
                  'size-8 rounded-md',
                  variant === 'b2c' ? 'bg-navy' : 'bg-[#0F1419]',
                )}
                aria-hidden
              />
              <span className="text-base font-bold tracking-tight">KOVAS</span>
            </Link>
            <p className="text-sm text-ink-mute leading-relaxed max-w-xs">
              L&apos;annuaire unifié des diagnostiqueurs immobiliers français. Logiciel terrain
              pensé pour et avec les professionnels.
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="https://www.linkedin.com/company/kovas-app"
                className="size-9 rounded-md border border-rule flex items-center justify-center hover:bg-ink/5 transition-colors"
                aria-label="LinkedIn KOVAS"
              >
                <Linkedin className="size-4 text-ink-mute" />
              </Link>
              <Link
                href="https://x.com/kovas_fr"
                className="size-9 rounded-md border border-rule flex items-center justify-center hover:bg-ink/5 transition-colors"
                aria-label="X / Twitter KOVAS"
              >
                <Twitter className="size-4 text-ink-mute" />
              </Link>
            </div>
          </div>

          <FooterColumn title="KOVAS Annuaire" links={LINKS_PARTICULIERS} />
          <FooterColumn title="KOVAS 360" links={LINKS_DIAGNOSTIQUEURS} />
          <FooterColumn title="KOVAS" links={LINKS_KOVAS} />
        </div>

        <div className="mt-12 pt-6 border-t border-rule/50 flex flex-col gap-2 md:flex-row md:items-center md:justify-between text-xs text-ink-faint">
          <p>
            © 2026 SASU {COMPANY_IDENTITY.legalName} · 66 av des Champs-Élysées, 75008 Paris ·
            SIREN {COMPANY_IDENTITY.sirenFormatted} · {COMPANY_IDENTITY.rcs.number} · TVA{' '}
            {COMPANY_IDENTITY.vatIntracom}
          </p>
          <p>
            Données : annuaire officiel DHUP (data.gouv.fr) · Made with care in France
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, links }: { title: string; links: FooterLink[] }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-mono uppercase tracking-wider text-ink-faint">{title}</h3>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-sm text-ink-mute hover:text-ink transition-colors"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
