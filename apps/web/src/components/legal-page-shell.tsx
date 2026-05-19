import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

type LegalPageShellProps = {
  title: string
  children: ReactNode
}

export function LegalPageShell({ title, children }: LegalPageShellProps) {
  return (
    <div className="min-h-dvh flex flex-col bg-sage">
      <header className="glass-header sticky top-0 z-50">
        <div className="mx-auto max-w-3xl px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div
              aria-hidden
              className="size-7 rounded-md bg-[#0F1419] shadow-accent flex items-center justify-center text-white font-bold text-xs"
            >
              K
            </div>
            <span className="font-display font-semibold tracking-tight text-ink">KOVAS</span>
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/">
              <ArrowLeft className="size-4" /> Accueil
            </Link>
          </Button>
        </div>
      </header>
      <main className="flex-1 mx-auto max-w-3xl w-full px-6 py-12 space-y-8">
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.1]">
          {title}.
        </h1>
        <div className="prose-legal space-y-4 text-[14px] text-ink-soft leading-relaxed">{children}</div>
      </main>
      <footer className="px-6 py-8 border-t border-rule text-[11px] text-ink-faint">
        <div className="mx-auto max-w-3xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p>© 2026 SASU Nexus 1993 · SIREN 982 786 154</p>
          <nav className="flex flex-wrap gap-x-4 gap-y-1 justify-center sm:justify-end">
            <Link href="/mentions-legales" className="hover:text-ink transition-colors">
              Mentions
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
    </div>
  )
}
