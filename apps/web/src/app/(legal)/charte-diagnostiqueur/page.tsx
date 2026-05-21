import type { Metadata } from 'next'

import { LegalRouteShell } from '@/components/legal/LegalRouteShell'
import { loadLegalDocument } from '@/lib/legal/load-document'

export const metadata: Metadata = {
  title: 'Charte du Diagnostiqueur Référencé',
  description:
    'Charte d’engagement applicable à tout Diagnostiqueur ayant Réclamé sa Fiche Professionnelle sur la Plateforme KOVAS — délais de réponse, déontologie, sanctions.',
  alternates: { canonical: '/charte-diagnostiqueur' },
  robots: { index: true, follow: true },
}

export default async function CharteDiagnostiqueurPage() {
  const document = await loadLegalDocument('08-charte-diagnostiqueur')
  return <LegalRouteShell document={document} />
}
