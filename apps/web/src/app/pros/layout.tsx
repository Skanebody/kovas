import { ProsHeader } from '@/components/public/pros/ProsHeader'
import { ProsNav } from '@/components/public/pros/ProsNav'
import { SiteFooter } from '@/components/site-footer'
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
    <div className="flex min-h-dvh flex-col bg-sage">
      <ProsHeader />
      <ProsNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
