import { getCurrentUser } from '@/lib/auth/current-user'
import type { DedupeResolution, FieldChoiceMap } from '@/lib/import/types'
import { NextResponse } from 'next/server'

/**
 * POST /api/import/liciel/dedupe/[jobId]/resolution
 *
 * Enregistre la résolution utilisateur sur un match de doublon donné.
 * Body JSON :
 *   {
 *     match_id: string (UUID)
 *     resolution: 'merge' | 'keep_separate' | 'replace' | 'skip'
 *     field_choices?: FieldChoiceMap
 *   }
 *
 * RLS via Supabase ssr client + helper `is_member_of()` → un user ne modifie
 * que les matches de son organisation. On filtre aussi par job_id pour éviter
 * qu'un match d'un autre job soit modifié par erreur (defense in depth).
 *
 * Idempotent : peut être appelée plusieurs fois pour mettre à jour la
 * résolution (utile pour le toggle UI).
 */
export const runtime = 'nodejs'

const VALID_RESOLUTIONS: DedupeResolution[] = ['merge', 'keep_separate', 'replace', 'skip']

interface ResolutionBody {
  match_id: string
  resolution: DedupeResolution
  field_choices?: FieldChoiceMap
}

function isValidUuid(s: unknown): s is string {
  return (
    typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  )
}

function parseBody(input: unknown): ResolutionBody | { error: string } {
  if (!input || typeof input !== 'object') {
    return { error: 'invalid body' }
  }
  const body = input as Record<string, unknown>
  if (!isValidUuid(body.match_id)) {
    return { error: 'match_id must be a UUID' }
  }
  const r = body.resolution
  if (typeof r !== 'string' || !VALID_RESOLUTIONS.includes(r as DedupeResolution)) {
    return { error: `resolution must be one of ${VALID_RESOLUTIONS.join(', ')}` }
  }
  let fieldChoices: FieldChoiceMap | undefined
  if (body.field_choices !== undefined) {
    if (typeof body.field_choices !== 'object' || body.field_choices === null) {
      return { error: 'field_choices must be an object' }
    }
    fieldChoices = body.field_choices as FieldChoiceMap
  }
  return {
    match_id: body.match_id,
    resolution: r as DedupeResolution,
    field_choices: fieldChoices,
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params

  if (!isValidUuid(jobId)) {
    return NextResponse.json({ error: 'invalid jobId' }, { status: 400 })
  }

  // ── Auth ──────────────────────────────────────────────────────────
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  let userId: string
  try {
    const u = await getCurrentUser()
    supabase = u.supabase
    userId = u.user.id
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // ── Parse body ────────────────────────────────────────────────────
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const parsed = parseBody(raw)
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  // ── Update match (RLS filtre par org) ─────────────────────────────
  const updatePayload = {
    resolution: parsed.resolution,
    field_choices: parsed.field_choices ?? null,
    resolved_by: userId,
    resolved_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('import_dedupe_matches')
    .update(updatePayload as never)
    .eq('id', parsed.match_id)
    .eq('job_id', jobId)
    .select('id')
    .maybeSingle<{ id: string }>()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) {
    return NextResponse.json({ error: 'match not found' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, match_id: data.id })
}
