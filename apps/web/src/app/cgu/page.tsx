import { LegalPageShell } from '@/components/legal-page-shell'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Conditions générales d\'utilisation' }

export default function CguPage() {
  return (
    <LegalPageShell title="Conditions générales d'utilisation">
      <p>
        L&apos;utilisation de KOVAS implique l&apos;acceptation des présentes CGU. Le service est
        fourni en l&apos;état, pour un usage professionnel de diagnostic immobilier.
      </p>
      <p>
        L&apos;abonnement est sans engagement de durée. Les données saisies restent la propriété du
        client. Export et suppression sont possibles à tout moment conformément au RGPD.
      </p>
      <p>
        Pour toute question contractuelle :{' '}
        <a href="mailto:benjamin@kovas.fr" className="text-navy underline-offset-4 hover:underline">
          benjamin@kovas.fr
        </a>
      </p>
    </LegalPageShell>
  )
}
