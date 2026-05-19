import { getCurrentUser } from '@/lib/auth/current-user'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * DELETE /api/import/[jobId]
 *
 * Annule un job (status → 'cancelled') et supprime le fichier source
 * dans le bucket `import-liciel-staging` (nom technique historique
 * conservé — cf. migration 20260520150000). Les rows staging sont
 * supprimées en cascade via ON DELETE CASCADE FK.
 *
 * On garde la row `import_jobs` (avec status='cancelled') pour audit.
 * La purge définitive interviendra au TTL 7 jours via cron.
 */
export const runtime = 'nodejs'

interface JobRow {
  id: string
  status: string
  source_storage_path: string | null
  organization_id: string
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params

  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  let orgId: string
  try {
    const u = await getCurrentUser()
    supabase = u.supabase
    orgId = u.orgId
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Charge le job pour récupérer son storage_path (RLS filtre par org)
  const { data: job, error: fetchErr } = await supabase
    .from('import_jobs')
    .select('id, status, source_storage_path, organization_id')
    .eq('id', jobId)
    .maybeSingle<JobRow>()

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 })
  }
  if (!job) {
    return NextResponse.json({ error: 'job not found' }, { status: 404 })
  }

  // Idempotence : déjà annulé ou terminé → OK
  if (job.status === 'cancelled' || job.status === 'completed') {
    return NextResponse.json({ ok: true, status: job.status })
  }

  // Update status='cancelled'
  const { error: updateErr } = await supabase
    .from('import_jobs')
    .update({ status: 'cancelled' } as never)
    .eq('id', jobId)

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Cleanup storage via service-role (RLS storage policy = auth user only,
  // mais on veut s'assurer que ça passe même si la policy diverge)
  if (job.source_storage_path && job.organization_id === orgId) {
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    await admin.storage.from('import-liciel-staging').remove([job.source_storage_path])
  }

  return NextResponse.json({ ok: true, status: 'cancelled' })
}
