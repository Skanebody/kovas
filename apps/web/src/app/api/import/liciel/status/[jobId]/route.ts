import { getCurrentUser } from '@/lib/auth/current-user'
import type { ImportJobStatus, JobStatusResponse } from '@/lib/import/types'
import { NextResponse } from 'next/server'

/**
 * GET /api/import/liciel/status/[jobId]
 *
 * Renvoie l'état courant d'un job d'import + une sous-étape normalisée
 * pour l'UI de progression. Polling toutes les 2s côté client.
 *
 * RLS via Supabase ssr client + helper `is_member_of()` → un user ne voit
 * que les jobs de son organisation.
 */
export const runtime = 'nodejs'

const STATUS_TO_PROGRESS: Record<
  ImportJobStatus,
  { substep: JobStatusResponse['current_substep']; percent: number | null }
> = {
  uploaded: { substep: null, percent: 5 },
  parsing: { substep: 'reading_file', percent: 15 },
  parsed: { substep: 'extracting_entities', percent: 30 },
  normalizing: { substep: 'normalizing_addresses', percent: 50 },
  normalized: { substep: 'verifying_sirets', percent: 65 },
  deduping: { substep: 'detecting_duplicates', percent: 80 },
  deduped: { substep: 'preparing_validation', percent: 95 },
  committing: { substep: 'preparing_validation', percent: 98 },
  completed: { substep: null, percent: 100 },
  failed: { substep: null, percent: null },
  cancelled: { substep: null, percent: null },
}

const JOB_COLUMNS = [
  'id',
  'status',
  'source_filename',
  'source_format',
  'detected_clients_count',
  'detected_properties_count',
  'detected_lots_count',
  'detected_coproprietes_count',
  'duplicates_clients_count',
  'duplicates_properties_count',
  'duplicates_coproprietes_count',
  'error_message',
  'created_at',
  'committed_at',
].join(', ')

interface JobRow {
  id: string
  status: ImportJobStatus
  source_filename: string
  source_format: JobStatusResponse['job']['source_format']
  detected_clients_count: number
  detected_properties_count: number
  detected_lots_count: number
  detected_coproprietes_count: number
  duplicates_clients_count: number
  duplicates_properties_count: number
  duplicates_coproprietes_count: number
  error_message: string | null
  created_at: string
  committed_at: string | null
}

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params

  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    supabase = u.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('import_jobs')
    .select(JOB_COLUMNS)
    .eq('id', jobId)
    .maybeSingle<JobRow>()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'job not found' }, { status: 404 })
  }

  const progress = STATUS_TO_PROGRESS[data.status] ?? { substep: null, percent: null }

  const response: JobStatusResponse = {
    job: {
      id: data.id,
      status: data.status,
      source_filename: data.source_filename,
      source_format: data.source_format,
      detected_clients_count: data.detected_clients_count,
      detected_properties_count: data.detected_properties_count,
      detected_lots_count: data.detected_lots_count,
      detected_coproprietes_count: data.detected_coproprietes_count,
      duplicates_clients_count: data.duplicates_clients_count,
      duplicates_properties_count: data.duplicates_properties_count,
      duplicates_coproprietes_count: data.duplicates_coproprietes_count,
      error_message: data.error_message,
      created_at: data.created_at,
      committed_at: data.committed_at,
    },
    current_substep: progress.substep,
    progress_percent: progress.percent,
  }

  return NextResponse.json(response)
}
