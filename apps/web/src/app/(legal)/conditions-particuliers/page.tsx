import type { Metadata } from 'next'

import { LegalRouteShell } from '@/components/legal/LegalRouteShell'
import { loadLegalDocument } from '@/lib/legal/load-document'

export const metadata: Metadata = {
  title: 'Conditions particulières de mise en relation B2C',
  description:
    'Conditions particulières applicables aux Particuliers sollicitant un devis via la Plateforme KOVAS, conformes aux dispositions des articles L.111-7 et suivants du Code de la consommation.',
  alternates: { canonical: '/conditions-particuliers' },
  robots: { index: true, follow: true },
}

export default async function ConditionsParticuliersPage() {
  const document = await loadLegalDocument('07-conditions-particuliers')
  return <LegalRouteShell document={document} />
}
