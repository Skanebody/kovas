import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Download } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ImportLicielWizard } from './wizard'

export const metadata: Metadata = {
  title: 'Importer depuis Liciel',
  description:
    'Récupérez votre base de clients, biens et copropriétés Liciel dans KOVAS en 5 minutes.',
}

/**
 * Page d'accueil de l'import Liciel — wizard 5 étapes.
 *
 * Le wizard est un composant client (state local). Cette page server ne fait
 * que setup les meta + la coquille AppPageHeader + la navigation back.
 *
 * Pour reprendre un job en cours, l'URL doit pointer vers
 * /app/dossiers/import-liciel/[jobId]/page.tsx (à créer dans un prochain
 * commit). Cette route-ci sert pour démarrer un nouvel import.
 *
 * Spec : prompt « Fonctionnalité Import Liciel ».
 * Cadre légal : art. 20 RGPD + CLAUDE.md §13 (stratégie défensive Liciel).
 */
export default function ImportLicielPage() {
  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/dossiers">
          <ArrowLeft className="size-4" /> Retour aux dossiers
        </Link>
      </Button>

      <AppPageHeader
        title="Importer depuis"
        accent="Liciel"
        eyebrow="📥 IMPORT BASE EXISTANTE · 5 MIN"
        description="Récupérez votre base de clients, biens et copropriétés depuis votre compte Liciel — dans le cadre de votre droit à la portabilité (art. 20 RGPD)."
        action={
          <Button variant="glass" size="sm" asChild>
            <a
              href="/help/import-liciel"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5"
            >
              <Download className="size-4" /> Aide détaillée
            </a>
          </Button>
        }
      />

      <ImportLicielWizard />
    </div>
  )
}
