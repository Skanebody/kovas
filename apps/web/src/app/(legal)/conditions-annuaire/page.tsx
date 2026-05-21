import type { Metadata } from 'next'

import { LegalRouteShell } from '@/components/legal/LegalRouteShell'
import { loadLegalDocument } from '@/lib/legal/load-document'

export const metadata: Metadata = {
  title: "Conditions particulières de l'annuaire",
  description:
    'Conditions particulières applicables aux Diagnostiqueurs Référencés sur la Plateforme KOVAS — fiches non-réclamées, procédure de Réclamation, niveaux Basique / Vérifié / Premium, mécanique pay-to-unlock.',
  alternates: { canonical: '/conditions-annuaire' },
  robots: { index: true, follow: true },
}

export default async function ConditionsAnnuairePage() {
  const document = await loadLegalDocument('06-conditions-annuaire')
  return <LegalRouteShell document={document} />
}
