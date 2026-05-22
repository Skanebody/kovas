import { SiteFooter } from '@/components/site-footer'
import type { ReactNode } from 'react'

/**
 * Layout commun des pages guides longs (`/guide` et `/guide/[type]`).
 *
 * Note : ce layout est volontairement minimaliste pour rester découplé du
 * shell marketing principal (qui n'est pas garanti d'exister sur toutes les
 * branches). Le footer canonique `<SiteFooter />` est suffisant pour les
 * pages SEO. Lors du cherry-pick sur main, on pourra basculer vers
 * `<PublicNav variant="b2c" />` + `<PublicFooter variant="b2c" />`
 * si ces composants sont disponibles.
 */
export default function GuideLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-sage">
      <main>{children}</main>
      <SiteFooter />
    </div>
  )
}
