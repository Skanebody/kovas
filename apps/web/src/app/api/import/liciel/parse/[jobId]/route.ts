import { getCurrentUser } from '@/lib/auth/current-user'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * POST /api/import/liciel/parse/[jobId]
 *
 * STUB FONCTIONNEL — mocke le parsing + dédoublonnage pour valider le flow
 * end-to-end avant l'implémentation réelle.
 *
 * Vrai flow à venir (itération suivante) :
 *   1. Lecture fichier Storage selon source_format (csv/xlsx/xml/zip-pdfs)
 *   2. Parser dédié (papaparse / xlsx / fast-xml-parser)
 *   3. Extraction Claude Haiku 4.5 si schéma ambigu
 *   4. Normalisation BAN + INSEE Sirene + libphonenumber
 *   5. Dédoublonnage vs `clients`, `properties`, `coproprietes` prod
 *
 * Cf. CLAUDE.md §13 + spec « Fonctionnalité Import Liciel ».
 */
export const runtime = 'nodejs'
export const maxDuration = 60

interface JobRow {
  id: string
  status: string
  organization_id: string
}

export async function POST(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
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
  if (job.status !== 'uploaded') {
    return NextResponse.json(
      { error: `job not in 'uploaded' state (current: ${job.status})` },
      { status: 409 },
    )
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // ── Étape 1 : passe en parsing ────────────────────────────────────
  await admin
    .from('import_jobs')
    .update({
      status: 'parsing',
      parsing_started_at: new Date().toISOString(),
    } as never)
    .eq('id', jobId)

  // ── Travail simulé ────────────────────────────────────────────────
  // TODO real parsing : appel parseLicielExport() + Claude extraction + normalizer + deduper
  await new Promise((r) => setTimeout(r, 1500))

  // ── Étape 2 : insère 3 clients fake + 2 properties fake ───────────
  const fakeClients = [
    {
      job_id: jobId,
      organization_id: orgId,
      raw_data: {},
      type: 'particulier',
      display_name: 'Jean Dupont',
      first_name: 'Jean',
      last_name: 'Dupont',
      status: 'pending',
      confidence_score: 0.95,
    },
    {
      job_id: jobId,
      organization_id: orgId,
      raw_data: {},
      type: 'particulier',
      display_name: 'Marie Martin',
      first_name: 'Marie',
      last_name: 'Martin',
      status: 'pending',
      confidence_score: 0.95,
    },
    {
      job_id: jobId,
      organization_id: orgId,
      raw_data: {},
      type: 'particulier',
      display_name: 'Pierre Bernard',
      first_name: 'Pierre',
      last_name: 'Bernard',
      status: 'pending',
      confidence_score: 0.95,
    },
  ]

  const { error: insertClientsErr } = await admin
    .from('import_staging_clients')
    .insert(fakeClients as never)

  if (insertClientsErr) {
    await admin
      .from('import_jobs')
      .update({
        status: 'failed',
        error_message: `staging clients insert: ${insertClientsErr.message}`,
      } as never)
      .eq('id', jobId)
    return NextResponse.json({ error: insertClientsErr.message }, { status: 500 })
  }

  const fakeProperties = [
    {
      job_id: jobId,
      organization_id: orgId,
      raw_data: {},
      property_type: 'appartement',
      address: '12 rue de la Paix',
      postal_code: '75002',
      city: 'Paris',
      status: 'pending',
      confidence_score: 0.9,
    },
    {
      job_id: jobId,
      organization_id: orgId,
      raw_data: {},
      property_type: 'maison',
      address: '5 chemin des Lilas',
      postal_code: '76200',
      city: 'Dieppe',
      status: 'pending',
      confidence_score: 0.9,
    },
  ]

  const { error: insertPropsErr } = await admin
    .from('import_staging_properties')
    .insert(fakeProperties as never)

  if (insertPropsErr) {
    await admin
      .from('import_jobs')
      .update({
        status: 'failed',
        error_message: `staging properties insert: ${insertPropsErr.message}`,
      } as never)
      .eq('id', jobId)
    return NextResponse.json({ error: insertPropsErr.message }, { status: 500 })
  }

  // ── Étape 3 : passe directement en 'deduped' (mock : on saute parsed/
  //              normalizing/normalized/deduping pour le flow E2E) ────
  const now = new Date().toISOString()
  const { error: finalErr } = await admin
    .from('import_jobs')
    .update({
      status: 'deduped',
      detected_clients_count: fakeClients.length,
      detected_properties_count: fakeProperties.length,
      parsing_completed_at: now,
      dedupe_completed_at: now,
    } as never)
    .eq('id', jobId)

  if (finalErr) {
    return NextResponse.json({ error: finalErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
