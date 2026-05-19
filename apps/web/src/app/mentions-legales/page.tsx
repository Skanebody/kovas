import { LegalPageShell } from '@/components/legal-page-shell'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Mentions légales' }

export default function MentionsLegalesPage() {
  return (
    <LegalPageShell title="Mentions légales">
      <p>
        <strong>Éditeur :</strong> SASU Nexus 1993 — 66 Avenue des Champs-Élysées, 75008 Paris — SIREN
        982 786 154
      </p>
      <p>
        <strong>Contact :</strong>{' '}
        <a href="mailto:benjamin@kovas.fr" className="text-navy underline-offset-4 hover:underline">
          benjamin@kovas.fr
        </a>
      </p>
      <p>
        <strong>Hébergement :</strong> Vercel Inc. (frontend) et Supabase (données, région Paris
        eu-west-3).
      </p>
      <p>
        KOVAS est un logiciel SaaS destiné aux diagnostiqueurs immobiliers professionnels. Les
        informations publiées sur ce site sont fournies à titre indicatif.
      </p>
    </LegalPageShell>
  )
}
