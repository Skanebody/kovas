import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

/**
 * Layout dédié pour /reclamer-ma-fiche/* (FIX-FF, mai 2026).
 *
 * Pourquoi un layout dédié ?
 *   Sans layout intermédiaire, la page tombait sur le RootLayout pur (body
 *   + providers), donc ni header ni footer publics. Benjamin a demandé un
 *   chrome public sobre (PublicHeader + SiteFooter) pour rassurer le
 *   diagnostiqueur qui clique depuis un email RGPD séquence #55.
 *
 * On évite ici tout AppSidebar / chrome dashboard puisque le visiteur n'est
 * pas authentifié.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function ReclamerMaFicheLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
