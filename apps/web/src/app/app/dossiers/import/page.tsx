import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Download } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ImportWizard } from './wizard'

export const metadata: Metadata = {
  title: 'Importer depuis votre logiciel',
  description:
    'Récupérez votre base de clients, biens et copropriétés depuis Liciel, AnalysImmo, OBBC, ORIS ou tout autre logiciel diag en 5 minutes.',
}

/**
 * Page d'accueil de l'import multi-source (logiciel diag) — wizard 5 étapes.
 *
 * Logiciels supportés V1 :
 *   - Liciel (mappings headers complets)
 *   - AnalysImmo / OBBC / ORIS (placeholders + fallback Claude Haiku)
 *   - Autre logiciel (fallback Claude Haiku direct)
 *
 * Le wizard est un composant client (state local). Cette page server ne fait
 * que setup les meta + la coquille AppPageHeader + la navigation back.
 *
 * Pour reprendre un job en cours, l'URL pointe vers
 * /app/dossiers/import/[jobId]/page.tsx. Cette route-ci sert pour démarrer
 * un nouvel import.
 *
 * Spec : prompt « Fonctionnalité Import logiciel diag ».
 * Cadre légal : art. 20 RGPD + CLAUDE.md §13 (stratégie défensive logiciels
 * concurrents).
 */
export default function ImportPage() {
  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/dossiers">
          <ArrowLeft className="size-4" /> Retour aux dossiers
        </Link>
      </Button>

      <AppPageHeader
        title="Importer depuis"
        accent="votre logiciel"
        eyebrow="📥 IMPORT BASE EXISTANTE · 5 MIN"
        description="Récupérez votre base de clients, biens et copropriétés depuis Liciel, AnalysImmo, OBBC, ORIS ou tout autre logiciel de diagnostic — dans le cadre de votre droit à la portabilité (art. 20 RGPD)."
        action={
          <Button variant="outline" size="sm" asChild>
            <a
              href="/help/import"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5"
            >
              <Download className="size-4" /> Aide détaillée
            </a>
          </Button>
        }
      />

      <ImportWizard />
    </div>
  )
}
