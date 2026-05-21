import type { Metadata } from 'next'

import { LegalRouteShell } from '@/components/legal/LegalRouteShell'
import { loadLegalDocument } from '@/lib/legal/load-document'

export const metadata: Metadata = {
  title: 'Conditions générales de vente',
  description:
    "Conditions générales de vente applicables aux Diagnostiqueurs Abonnés à l'un des Forfaits payants KOVAS (Essential, Découverte, Pro, All Inclusive, Cabinet).",
  alternates: { canonical: '/cgv' },
  robots: { index: true, follow: true },
}

export default async function CgvPage() {
  const document = await loadLegalDocument('03-cgv')
  return <LegalRouteShell document={document} />
}
