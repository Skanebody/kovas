import { LegalPageShell } from '@/components/legal-page-shell'
import { Button } from '@/components/ui/button'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Contact' }

export default function ContactPage() {
  return (
    <LegalPageShell title="Contact">
      <p>
        Une question sur KOVAS, votre compte ou une démo ? Écrivez-nous — réponse sous 24h ouvrées.
      </p>
      <p>
        <strong>Email :</strong>{' '}
        <a href="mailto:benjamin@kovas.fr" className="text-navy underline-offset-4 hover:underline">
          benjamin@kovas.fr
        </a>
      </p>
      <p>
        <strong>Adresse :</strong> SASU Nexus 1993, 66 Avenue des Champs-Élysées, 75008 Paris
      </p>
      <Button asChild variant="warm">
        <a href="mailto:benjamin@kovas.fr">Envoyer un email</a>
      </Button>
    </LegalPageShell>
  )
}
