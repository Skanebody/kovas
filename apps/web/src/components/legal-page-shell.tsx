import { Button } from '@/components/ui/button'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

type LegalPageShellProps = {
  title: string
  children: ReactNode
}

export function LegalPageShell({ title, children }: LegalPageShellProps) {
  return (
    <div className="min-h-dvh flex flex-col bg-sage text-[#0F1419] font-sans">
      <header className="sticky top-0 z-30 bg-[#F5F7F4]/[0.86] backdrop-blur-xl border-b border-[#0F1419]/[0.08]">
        <div className="mx-auto max-w-3xl px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="font-semibold tracking-[0.22em] text-[15px] text-[#0F1419]"
          >
            KOVAS
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="size-4" /> Accueil
            </Link>
          </Button>
        </div>
      </header>
      <main className="flex-1 mx-auto max-w-3xl w-full px-6 py-12 space-y-8">
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-[#0F1419] leading-[1.1]">
          {title}.
        </h1>
        <div className="prose-legal space-y-4 text-[14px] text-[#0F1419]/72 leading-relaxed">{children}</div>
      </main>
      <footer className="border-t border-[#0F1419]/[0.08] px-6 py-8 text-[11px] text-[#0F1419]/55 bg-[#F5F7F4]">
        <div className="mx-auto max-w-3xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p>
            © 2026 SASU {COMPANY_IDENTITY.legalName} · SIREN {COMPANY_IDENTITY.sirenFormatted}
          </p>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 justify-center sm:justify-end">
            <Link href="/mentions-legales" className="hover:text-[#0F1419] transition-colors">
              Mentions
            </Link>
            <Link href="/cgu" className="hover:text-[#0F1419] transition-colors">
              CGU
            </Link>
            <Link href="/confidentialite" className="hover:text-[#0F1419] transition-colors">
              Confidentialité
            </Link>
            <Link href="/contact" className="hover:text-[#0F1419] transition-colors">
              Contact
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
