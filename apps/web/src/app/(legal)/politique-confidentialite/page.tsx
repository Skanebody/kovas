import type { Metadata } from 'next'

import { LegalRouteShell } from '@/components/legal/LegalRouteShell'
import { loadLegalDocument } from '@/lib/legal/load-document'

export const metadata: Metadata = {
  title: 'Politique de confidentialité',
  description:
    'Politique de protection des données à caractère personnel de la Plateforme KOVAS — finalités, bases juridiques, durées de conservation, droits RGPD.',
  alternates: { canonical: '/politique-confidentialite' },
  robots: { index: true, follow: true },
}

export default async function PolitiqueConfidentialitePage() {
  const document = await loadLegalDocument('04-politique-confidentialite')
  return <LegalRouteShell document={document} />
}
