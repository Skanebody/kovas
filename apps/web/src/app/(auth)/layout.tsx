import Link from 'next/link'
import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-fluid-light">
      <header className="px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="size-8 rounded-md bg-navy shadow-accent" aria-hidden />
          <span className="font-display text-base font-semibold tracking-tight text-ink">KOVAS</span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm glass-opaque rounded-xl p-8 border border-rule/80 shadow-glass-sm">
          {children}
        </div>
      </main>
      <footer className="px-6 py-4 text-[11px] text-ink-faint text-center">
        © 2026 SASU Nexus 1993 · SIREN 982 786 154
      </footer>
    </div>
  )
}
