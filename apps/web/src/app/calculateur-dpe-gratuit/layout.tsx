import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import type { ReactNode } from 'react'

/**
 * Layout du calculateur DPE B2C avec navigation publique partagée.
 *
 * Audit FIX-V (2026-05-23) : la page /calculateur-dpe-gratuit n'avait
 * jamais été branchée sur PublicHeader + SiteFooter — les visiteurs ne
 * pouvaient pas naviguer vers les autres pages du site (annuaire,
 * observatoire, guides, pricing…). Aligné maintenant sur le shell
 * marketing canonique de /faq, /guide, /pros/*, /trouver-un-diagnostiqueur.
 */
export default function CalculateurLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
