import { AppPageHeader } from '@/components/app-page-header'
import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { ImportJobStatus } from '@/lib/import/types'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { JobStatusPoller } from './job-status-poller'

export const metadata: Metadata = {
  title: 'Analyse de l’import Liciel',
}

interface JobRow {
  id: string
  status: ImportJobStatus
  source_filename: string
  organization_id: string
}

/**
 * Page de suivi d'un job d'import Liciel (étape 4 du wizard).
 *
 * Rend un composant client polling toutes les 2s sur
 * /api/import/liciel/status/[jobId] avec l'UI de progression des 7 sous-étapes.
 *
 * Si le job est déjà 'completed', on redirige vers /app/dossiers?imported=…
 * (placeholder — la step 5 de validation final commit sera implémentée
 * dans une itération suivante).
 */
export default async function ImportLicielJobPage({
  params,
}: {
  params: Promise<{ jobId: string }>
}) {
  const { jobId } = await params

  const { supabase } = await getCurrentUser()
  const { data: job } = await supabase
    .from('import_jobs')
    .select('id, status, source_filename, organization_id')
    .eq('id', jobId)
    .maybeSingle<JobRow>()

  if (!job) {
    notFound()
  }

  if (job.status === 'completed') {
    redirect(`/app/dossiers?imported=${job.id}`)
  }

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/app/dossiers/import-liciel">
          <ArrowLeft className="size-4" /> Nouveau import
        </Link>
      </Button>

      <AppPageHeader
        title="Analyse de"
        accent="votre fichier Liciel"
        eyebrow="📥 IMPORT · ÉTAPE 4 / 5"
        description={`Fichier : ${job.source_filename}. Suivi temps réel de l'extraction, normalisation et détection des doublons.`}
      />

      <JobStatusPoller jobId={job.id} initialStatus={job.status} />
    </div>
  )
}
