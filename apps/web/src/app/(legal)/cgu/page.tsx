import type { Metadata } from 'next'

import { LegalRouteShell } from '@/components/legal/LegalRouteShell'
import { loadLegalDocument } from '@/lib/legal/load-document'

export const metadata: Metadata = {
  title: "Conditions générales d'utilisation",
  description:
    "Conditions générales d'utilisation applicables à tout Utilisateur accédant à la Plateforme KOVAS.",
  alternates: { canonical: '/cgu' },
  robots: { index: true, follow: true },
}

export default async function CguPage() {
  const document = await loadLegalDocument('02-cgu')
  return <LegalRouteShell document={document} />
}
