import { LegalPageShell } from '@/components/legal-page-shell'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Politique de confidentialité' }

export default function ConfidentialitePage() {
  return (
    <LegalPageShell title="Politique de confidentialité">
      <p>
        KOVAS traite vos données pour fournir le service (compte, dossiers, missions, exports).
        Base légale : exécution du contrat et intérêt légitime professionnel.
      </p>
      <p>
        Données hébergées en Union européenne (Supabase Paris). Chiffrement en transit (TLS) et au
        repos. Durée de conservation : durée du contrat + 30 jours après résiliation pour export,
        sauf obligation légale.
      </p>
      <p>
        Vous disposez d&apos;un droit d&apos;accès, rectification, suppression et portabilité :
        contactez{' '}
        <a href="mailto:benjamin@kovas.fr" className="text-navy underline-offset-4 hover:underline">
          benjamin@kovas.fr
        </a>
        .
      </p>
    </LegalPageShell>
  )
}
