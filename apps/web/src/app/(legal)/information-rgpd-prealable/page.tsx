import type { Metadata } from 'next'

import { LegalRouteShell } from '@/components/legal/LegalRouteShell'
import { loadLegalDocument } from '@/lib/legal/load-document'

export const metadata: Metadata = {
  title: 'Information préalable RGPD (article 14)',
  description:
    "Information préalable au sens de l'article 14 du RGPD, à destination des Diagnostiqueurs Référencés n'ayant pas Réclamé leur Fiche Professionnelle sur la Plateforme KOVAS.",
  alternates: { canonical: '/information-rgpd-prealable' },
  // Page d'information dont l'indexation publique n'apporte pas de valeur (cible
  // courriel article 14). On garde follow:true mais index:false par convention.
  robots: { index: false, follow: true },
}

export default async function InformationRgpdPrealablePage() {
  const document = await loadLegalDocument('09-information-prealable-rgpd')
  return <LegalRouteShell document={document} />
}
