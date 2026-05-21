import type { Metadata } from 'next'

import { LegalRouteShell } from '@/components/legal/LegalRouteShell'
import { loadLegalDocument } from '@/lib/legal/load-document'

export const metadata: Metadata = {
  title: 'Mentions légales',
  description:
    'Mentions légales de la Plateforme KOVAS — éditeur, hébergement, propriété intellectuelle, médiateur de la consommation.',
  alternates: { canonical: '/mentions-legales' },
  robots: { index: true, follow: true },
}

export default async function MentionsLegalesPage() {
  const document = await loadLegalDocument('01-mentions-legales')
  return <LegalRouteShell document={document} />
}
