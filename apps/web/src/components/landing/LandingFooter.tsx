import Link from 'next/link'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'

/**
 * Footer marketing partagé home + pricing — mirror exact du mockup.
 *
 * Layout : copyright à gauche + deux colonnes de liens à droite (Infos / Légal).
 * La colonne Légal expose les 9 documents du pack juridique KOVAS v1.1
 * (2 juin 2026), à l'exception du Document 9 (information préalable RGPD)
 * qui reste accessible directement mais n'est pas mis en avant ici car cible
 * essentiellement courriel article 14.
 */
export function LandingFooter() {
  return (
    <footer className="border-t border-[#0F1419]/[0.08] px-5 sm:px-12 py-10 text-[13px] text-[#0F1419]/55 bg-[#F5F7F4]">
      <div className="max-w-[1240px] mx-auto flex flex-col md:flex-row md:justify-between gap-8">
        <div className="md:max-w-sm">
          © 2026 SASU {COMPANY_IDENTITY.legalName} · {COMPANY_IDENTITY.address.line1},{' '}
          {COMPANY_IDENTITY.address.postalCode} {COMPANY_IDENTITY.address.city} · SIREN{' '}
          {COMPANY_IDENTITY.sirenFormatted} · RCS Paris
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-10 gap-y-6">
          <nav aria-label="Liens utiles" className="flex flex-col gap-2">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
              Infos
            </p>
            <Link href="/faq" className="hover:text-[#0F1419] transition-colors">
              FAQ
            </Link>
            <Link href="/contact" className="hover:text-[#0F1419] transition-colors">
              Contact
            </Link>
            <Link href="/pricing" className="hover:text-[#0F1419] transition-colors">
              Tarifs
            </Link>
          </nav>
          <nav aria-label="Documents juridiques" className="flex flex-col gap-2">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
              Légal
            </p>
            <Link href="/mentions-legales" className="hover:text-[#0F1419] transition-colors">
              Mentions légales
            </Link>
            <Link href="/cgu" className="hover:text-[#0F1419] transition-colors">
              CGU
            </Link>
            <Link href="/cgv" className="hover:text-[#0F1419] transition-colors">
              CGV
            </Link>
            <Link
              href="/politique-confidentialite"
              className="hover:text-[#0F1419] transition-colors"
            >
              Politique RGPD
            </Link>
            <Link href="/cookies" className="hover:text-[#0F1419] transition-colors">
              Cookies
            </Link>
          </nav>
          <nav aria-label="Pack professionnel" className="flex flex-col gap-2">
            <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
              Pro & B2C
            </p>
            <Link href="/conditions-annuaire" className="hover:text-[#0F1419] transition-colors">
              Conditions Annuaire
            </Link>
            <Link
              href="/conditions-particuliers"
              className="hover:text-[#0F1419] transition-colors"
            >
              Conditions Particuliers
            </Link>
            <Link href="/charte-diagnostiqueur" className="hover:text-[#0F1419] transition-colors">
              Charte Diagnostiqueur
            </Link>
            <Link
              href="/information-rgpd-prealable"
              className="hover:text-[#0F1419] transition-colors"
            >
              Information RGPD préalable
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}
