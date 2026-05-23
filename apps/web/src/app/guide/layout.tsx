import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import type { ReactNode } from 'react'

/**
 * Layout commun des pages guides longs (`/guide` index et `/guide/[type]`).
 *
 * Lot #153 SITE-POLISH : aligné sur le shell marketing canonique
 * (PublicHeader + SiteFooter) comme la home, /faq et les pages
 * institutionnelles. Le footer minimaliste précédent (sans nav publique)
 * isolait les pages guide du parcours SEO/maillage interne.
 */
export default function GuideLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
