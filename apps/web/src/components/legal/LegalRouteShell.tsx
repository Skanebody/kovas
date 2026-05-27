import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

import { LegalDocumentRenderer } from '@/components/legal/LegalDocumentRenderer'
import { Button } from '@/components/ui/button'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'
import type { LegalDocument } from '@/lib/legal/load-document'

interface LegalRouteShellProps {
  readonly document: LegalDocument
}

/**
 * Shell partagé par les 9 routes publiques du pack juridique.
 *
 * Compose :
 *   - Header sticky (logo KOVAS + bouton retour accueil)
 *   - Layout 3 colonnes desktop : TOC sticky (gauche) · corps document (centre) ·
 *     spacer (droit)
 *   - Sur mobile : TOC repliable en `<details>` au-dessus du contenu
 *   - Footer minimal "Document validé v1.X — date"
 *
 * Le ton typographique suit le design system v5 :
 *   - Titre H1 en `font-serif italic` (Instrument Serif), 4xl/5xl
 *   - Corps en `font-sans` (Manrope) 14-16px, leading-relaxed
 *   - Mono `JetBrains Mono` pour les en-têtes de tables et les références aux articles
 */
export function LegalRouteShell({ document }: LegalRouteShellProps) {
  const tocSections = document.toc.filter((entry) => entry.level === 2)
  return (
    <div className="flex flex-col min-h-dvh">
      <header className="sticky top-0 z-30 bg-[#F5F7F4]/[0.86] backdrop-blur-xl border-b border-[#0F1419]/[0.08]">
        <div className="mx-auto max-w-[1240px] px-5 sm:px-8 h-14 flex items-center justify-between">
          <Link href="/" className="font-semibold tracking-[0.22em] text-[15px] text-[#0F1419]">
            KOVAS
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" className="text-[13px]">
              <ArrowLeft className="size-4" aria-hidden="true" /> Accueil
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[1240px] px-5 sm:px-8 py-10 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-[260px_minmax(0,1fr)] gap-10">
          {/* TOC sticky desktop / repliable mobile */}
          <aside className="md:sticky md:top-24 md:self-start order-2 md:order-1">
            <details className="md:open:contents" open>
              <summary className="md:hidden cursor-pointer font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 mb-2">
                Table des matières
              </summary>
              <nav aria-label="Table des matières">
                <p className="hidden md:block font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55 mb-3">
                  Sommaire
                </p>
                <ol className="space-y-1.5 text-[13px] leading-snug">
                  {tocSections.map((entry) => (
                    <li key={entry.anchor}>
                      <a
                        href={`#${entry.anchor}`}
                        className="text-[#0F1419]/70 hover:text-[#0F1419] hover:underline underline-offset-4 transition-colors"
                      >
                        {entry.text}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </details>
          </aside>

          {/* Corps du document */}
          <article className="order-1 md:order-2 max-w-3xl">
            <header className="mb-8 space-y-3">
              <p className="font-mono uppercase tracking-wider text-[11px] text-[#0F1419]/55">
                Pack juridique KOVAS · {document.versionLabel}
              </p>
              <h1 className="font-serif italic text-4xl md:text-5xl tracking-tight leading-[1.1] text-[#0F1419]">
                {document.title.toLowerCase()}.
              </h1>
            </header>
            <LegalDocumentRenderer content={document.content} toc={document.toc} />
          </article>
        </div>
      </main>

      <footer className="border-t border-[#0F1419]/[0.08] px-5 sm:px-8 py-8 text-[12px] text-[#0F1419]/55 bg-[#F5F7F4]">
        <div className="mx-auto max-w-[1240px] flex flex-col md:flex-row md:justify-between gap-3">
          <p>
            Document validé en sa {document.versionLabel}. © 2026 SASU {COMPANY_IDENTITY.legalName}{' '}
            · SIREN {COMPANY_IDENTITY.sirenFormatted}.
          </p>
          <nav aria-label="Navigation pack juridique" className="flex flex-wrap gap-x-4 gap-y-1">
            <Link href="/mentions-legales" className="hover:text-[#0F1419] transition-colors">
              Mentions
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
              Confidentialité
            </Link>
            <Link href="/cookies" className="hover:text-[#0F1419] transition-colors">
              Cookies
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
