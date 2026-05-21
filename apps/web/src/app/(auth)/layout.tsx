import Link from 'next/link'
import type { ReactNode } from 'react'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'

/**
 * Layout des écrans non authentifiés (login + signup).
 *
 * Design System v5 strict :
 *  - Fond sage `#F5F7F4` (pas de gradient)
 *  - Header sticky avec logo lettré KOVAS 360 tracking large (mirror LandingHeader)
 *  - Card centrale opaque (paper white) + bordure 1px ink/8% + rounded-2xl 24px
 *  - Footer minimal mentions légales
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-[#F5F7F4]">
      <header className="px-5 sm:px-12 h-14 sm:h-16 flex items-center justify-between">
        <Link
          href="/"
          className="font-sans font-semibold tracking-[0.22em] text-[15px] text-[#0F1419]"
        >
          KOVAS 360
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm bg-white rounded-2xl p-8 border border-[#0F1419]/[0.08] shadow-sm">
          {children}
        </div>
      </main>
      <footer className="px-6 py-4 text-[11px] text-[#0F1419]/55 text-center">
        © 2026 SASU {COMPANY_IDENTITY.legalName} · SIREN {COMPANY_IDENTITY.sirenFormatted}
      </footer>
    </div>
  )
}
