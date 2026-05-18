import Link from 'next/link'
import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      <header className="px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-base font-semibold tracking-tight">
          KOVAS
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">{children}</main>
      <footer className="px-6 py-4 text-xs text-subtle-foreground text-center">
        © 2026 SASU Nexus 1993 · SIREN 982 786 154
      </footer>
    </div>
  )
}
