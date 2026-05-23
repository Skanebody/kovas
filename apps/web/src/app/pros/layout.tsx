import { SiteFooter } from '@/components/public/footer/SiteFooter'
import { PublicHeader } from '@/components/public/header/PublicHeader'
import { ProsNav } from '@/components/public/pros/ProsNav'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: {
    default: 'KOVAS — Espace diagnostiqueurs',
    template: '%s · KOVAS Pros',
  },
  description:
    'Le SaaS moderne du diagnostic immobilier. Saisie vocale, photos terrain, exports universels, pré-vérification ADEME.',
}

export default function ProsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PublicHeader />
      <ProsNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
