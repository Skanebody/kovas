import { LegalPageShell } from '@/components/legal-page-shell'
import { Button } from '@/components/ui/button'
import { COMPANY_IDENTITY } from '@/lib/legal/company-identity'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Contact' }

export default function ContactPage() {
  return (
    <LegalPageShell title="Contact">
      <p>
        Une question sur KOVAS, votre compte ou une démo ? Écrivez-nous — réponse sous 24h ouvrées.
      </p>
      <p>
        <strong className="font-semibold text-[#0F1419]">Email :</strong>{' '}
        <a
          href="mailto:benjamin@kovas.fr"
          className="text-[#0F1419] underline-offset-4 hover:underline"
        >
          benjamin@kovas.fr
        </a>
      </p>
      <p>
        <strong className="font-semibold text-[#0F1419]">Adresse :</strong> SASU{' '}
        {COMPANY_IDENTITY.legalName}, {COMPANY_IDENTITY.address.line1},{' '}
        {COMPANY_IDENTITY.address.postalCode} {COMPANY_IDENTITY.address.city}
      </p>
      <div className="pt-2">
        <Button asChild variant="accent">
          <a href="mailto:benjamin@kovas.fr">Envoyer un email</a>
        </Button>
      </div>
    </LegalPageShell>
  )
}
