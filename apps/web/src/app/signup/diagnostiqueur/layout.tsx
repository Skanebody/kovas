import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * KOVAS — Layout dédié onboarding diagnostiqueur 7 étapes (Doctolib-style 2022).
 *
 * Spécifications :
 *  - Pas de sidebar dashboard (parcours marketing avant activation compte)
 *  - PublicHeader minimaliste : logo KOVAS + "Besoin d'aide ?" → contact@kovas.fr
 *  - Background sage `#F5F7F4` v5 strict
 *  - Footer minimal mentions
 *
 * Note : la progress bar des 7 étapes est rendue par chaque page selon
 * `?step=N` plutôt qu'au niveau layout (server boundary).
 */
export default function DiagnostiqueurOnboardingLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh flex flex-col bg-[#F5F7F4]">
      <header className="px-5 sm:px-12 h-14 sm:h-16 flex items-center justify-between border-b border-[#0F1419]/[0.06]">
        <Link
          href="/"
          className="font-sans font-semibold tracking-[0.22em] text-[15px] text-[#0F1419]"
        >
          KOVAS
        </Link>
        <a
          href="mailto:contact@kovas.fr"
          className="text-[13px] font-medium text-[#0F1419]/70 hover:text-[#0F1419] transition-colors"
        >
          Besoin d&apos;aide&nbsp;? contact@kovas.fr
        </a>
      </header>
      <main className="flex-1 flex flex-col items-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="w-full max-w-2xl">{children}</div>
      </main>
      <footer className="px-6 py-4 text-[11px] text-[#0F1419]/55 text-center border-t border-[#0F1419]/[0.06]">
        Vos documents sont chiffrés et stockés en France (Supabase Paris, OVHcloud). Procédure de
        validation conforme RGPD.
      </footer>
    </div>
  )
}
