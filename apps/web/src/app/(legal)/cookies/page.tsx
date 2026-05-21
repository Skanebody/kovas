import type { Metadata } from 'next'

import { LegalRouteShell } from '@/components/legal/LegalRouteShell'
import { loadLegalDocument } from '@/lib/legal/load-document'

export const metadata: Metadata = {
  title: 'Politique de gestion des traceurs et cookies',
  description:
    "Politique de gestion des cookies et autres traceurs de la Plateforme KOVAS, conforme à l'article 82 de la loi Informatique et Libertés.",
  alternates: { canonical: '/cookies' },
  robots: { index: true, follow: true },
}

export default async function CookiesPage() {
  const document = await loadLegalDocument('05-politique-cookies')
  return <LegalRouteShell document={document} />
}
