import { getCurrentUser } from '@/lib/auth/current-user'
import type { CommitResponse, ImportJobStatus } from '@/lib/import/types'
import { NextResponse } from 'next/server'

/**
 * POST /api/import/liciel/commit/[jobId]
 *
 * Finalise un import Liciel en appelant la RPC `commit_import_job(uuid)`
 * qui insère les staging vers la prod (clients / properties / coproprietes
 * / lots) selon les résolutions de doublons enregistrées via
 * `/api/import/liciel/dedupe/[jobId]/resolution`.
 *
 * Préconditions :
 *   - job.status ∈ {'deduped', 'normalized', 'parsed'}
 *   - aucun `import_dedupe_matches.resolution` à NULL
 *
 * La transaction est gérée côté SQL (plpgsql atomique). En cas d'erreur, le
 * job passe en 'failed' avec error_message dans le bloc EXCEPTION de la RPC.
 */
export const runtime = 'nodejs'
export const maxDuration = 60

interface JobRow {
  id: string
  status: ImportJobStatus
  organization_id: string
}

interface CommitRpcResult {
  job_id: string
  imported: {
    clients: number
    properties: number
    coproprietes: number
    lots: number
  }
  merged: {
    clients: number
    properties: number
    coproprietes: number
  }
  skipped: {
    clients: number
    properties: number
    coproprietes: number
  }
}

export async function POST(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params

  // ── Auth ──────────────────────────────────────────────────────────
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  let orgId: string
  try {
    const u = await getCurrentUser()
    supabase = u.supabase
    orgId = u.orgId
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // ── Vérif job (RLS filtre par org via is_member_of) ───────────────
  const { data: job, error: fetchErr } = await supabase
    .from('import_jobs')
    .select('id, status, organization_id')
    .eq('id', jobId)
    .maybeSingle<JobRow>()

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!job) {
    return NextResponse.json({ error: 'job not found' }, { status: 404 })
  }
  if (job.organization_id !== orgId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  if (!['deduped', 'normalized', 'parsed'].includes(job.status)) {
    return NextResponse.json(
      { error: `job status invalid for commit (current: ${job.status})` },
      { status: 409 },
    )
  }

  // ── Vérif : aucun match non résolu ────────────────────────────────
  const { count: unresolved, error: countErr } = await supabase
    .from('import_dedupe_matches')
    .select('id', { count: 'exact', head: true })
    .eq('job_id', jobId)
    .is('resolution', null)

  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 })
  }
  if ((unresolved ?? 0) > 0) {
    return NextResponse.json(
      {
        error: 'UNRESOLVED_DUPLICATES',
        message: `${unresolved} doublon(s) non résolu(s)`,
        unresolved_count: unresolved,
      },
      { status: 409 },
    )
  }

  // ── Appel RPC commit_import_job ───────────────────────────────────
  // biome-ignore lint/suspicious/noExplicitAny: RPC pas dans types generator
  const { data, error } = await (supabase as any).rpc('commit_import_job', {
    p_job_id: jobId,
  })

  if (error) {
    return NextResponse.json(
      { error: error.message ?? 'commit_import_job failed', code: error.code },
      { status: 500 },
    )
  }

  const result = data as CommitRpcResult
  const response: CommitResponse = {
    job_id: result.job_id,
    imported: result.imported,
    merged: result.merged,
    skipped: result.skipped,
  }
  return NextResponse.json(response)
}
