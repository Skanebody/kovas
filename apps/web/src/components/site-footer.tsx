import { cn } from '@/lib/utils'
import Link from 'next/link'

type SiteFooterProps = {
  className?: string
}

/** Pied de page marketing (landing, pricing, FAQ). */
export function SiteFooter({ className }: SiteFooterProps) {
  return (
    <footer className={cn('px-6 py-10 border-t border-rule', className)}>
      <div className="mx-auto max-w-6xl flex flex-col gap-4 md:flex-row md:items-center md:justify-between text-sm text-ink-faint">
        <p>© 2026 SASU Nexus 1993 · 66 Av Champs Elysées, 75008 Paris · SIREN 982 786 154</p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Liens légaux">
          <Link href="/faq" className="hover:text-ink transition-colors">
            FAQ
          </Link>
          <Link href="/mentions-legales" className="hover:text-ink transition-colors">
            Mentions légales
          </Link>
          <Link href="/cgu" className="hover:text-ink transition-colors">
            CGU
          </Link>
          <Link href="/confidentialite" className="hover:text-ink transition-colors">
            Confidentialité
          </Link>
          <Link href="/contact" className="hover:text-ink transition-colors">
            Contact
          </Link>
        </nav>
      </div>
    </footer>
  )
}
