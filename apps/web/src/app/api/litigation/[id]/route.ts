/**
 * KOVAS — Gestion d'un litige (lecture + transitions de statut).
 *
 *   GET   /api/litigation/[id]
 *   PATCH /api/litigation/[id]  { status?, regenerate?, escalateReason?, resolutionOutcome? }
 *
 * Source de vérité : table `litigation_workflows` (migration 20260525121000).
 * Les statuts sont contraints par le CHECK SQL :
 *   opened | in_progress | awaiting_third_party | escalated | resolved | closed | dropped
 * « Escalader au tribunal » → `escalated` (l'UI legacy envoie `court`, traduit ici).
 * « Marquer résolu » → `resolved` + `resolved_at = now()` + `resolution_outcome`.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import type { Json } from '@kovas/database/types'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/** Forme du brouillon IA persisté dans `litigation_workflows.metadata.draft`. */
interface DraftMetadata {
  response_md?: string | null
  cited_references?: string[] | null
  generated_at?: string | null
}

/** Sous-ensemble des colonnes `litigation_workflows` lues ici. */
interface LitigationWorkflowRow {
  id: string
  status: string
  opened_at: string
  notes: string | null
  metadata: Record<string, unknown> | null
}

/** Payload de réponse exposé à l'UI (litige + brouillon IA éventuel). */
interface LitigationResponse {
  id: string
  status: string
  openedAt: string
  reason: string
  aiSuggestedResponse: string
  citedReferences: string[]
  draftGeneratedAt: string | null
}

/** Statuts réels acceptés par le CHECK `litigation_workflows.status`. */
type DbStatus =
  | 'opened'
  | 'in_progress'
  | 'awaiting_third_party'
  | 'escalated'
  | 'resolved'
  | 'closed'
  | 'dropped'

/** Issues réelles attendues dans `resolution_outcome`. */
type ResolutionOutcome = 'in_favor' | 'against' | 'compromise' | 'dropped'

const VALID_RESOLUTION_OUTCOMES: ResolutionOutcome[] = [
  'in_favor',
  'against',
  'compromise',
  'dropped',
]

function readDraft(metadata: Record<string, unknown> | null): DraftMetadata {
  if (!metadata || typeof metadata.draft !== 'object' || metadata.draft === null) {
    return {}
  }
  return metadata.draft as DraftMetadata
}

function readReason(row: LitigationWorkflowRow): string {
  if (row.notes && row.notes.trim().length > 0) return row.notes
  if (row.metadata && typeof row.metadata.client_complaint === 'string') {
    return row.metadata.client_complaint
  }
  return ''
}

async function load(
  supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase'],
  orgId: string,
  id: string,
): Promise<LitigationResponse | null> {
  const { data } = await supabase
    .from('litigation_workflows')
    .select('id, status, opened_at, notes, metadata')
    .eq('id', id)
    .eq('organization_id', orgId)
    .maybeSingle()

  const row = data as LitigationWorkflowRow | null
  if (!row) return null
  const draft = readDraft(row.metadata)
  return {
    id: row.id,
    status: row.status,
    openedAt: row.opened_at,
    reason: readReason(row),
    aiSuggestedResponse: draft.response_md ?? '',
    citedReferences: Array.isArray(draft.cited_references) ? draft.cited_references : [],
    draftGeneratedAt: draft.generated_at ?? null,
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }
  try {
    const { orgId, supabase } = await getCurrentUser()
    const out = await load(supabase, orgId, id)
    if (!out) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json(out)
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
}

interface PatchBody {
  /** Statut cible UI ; `court` (legacy) est traduit en `escalated`. */
  status?: DbStatus | 'court'
  regenerate?: boolean
  escalateReason?: string
  /** Issue du litige quand on marque résolu (défaut `compromise`). */
  resolutionOutcome?: ResolutionOutcome
}

/**
 * Traduit le statut demandé par l'UI vers une valeur acceptée par le CHECK DB.
 * `court` (taxonomie UI legacy) → `escalated`.
 */
function normalizeStatus(status: DbStatus | 'court'): DbStatus {
  return status === 'court' ? 'escalated' : status
}

const ALLOWED_INCOMING: (DbStatus | 'court')[] = [
  'opened',
  'in_progress',
  'awaiting_third_party',
  'escalated',
  'court',
  'resolved',
  'closed',
  'dropped',
]

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  let orgId: string
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
    supabase = u.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (body.status && !ALLOWED_INCOMING.includes(body.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 })
  }

  const nextStatus = body.status ? normalizeStatus(body.status) : null

  if (nextStatus === 'escalated' && (body.escalateReason ?? '').trim().length < 20) {
    return NextResponse.json({ error: 'escalate_reason_required' }, { status: 400 })
  }

  if (body.resolutionOutcome && !VALID_RESOLUTION_OUTCOMES.includes(body.resolutionOutcome)) {
    return NextResponse.json({ error: 'invalid_resolution_outcome' }, { status: 400 })
  }

  if (nextStatus) {
    // Recharge le metadata existant pour un merge non destructif (escalade).
    const { data: current } = await supabase
      .from('litigation_workflows')
      .select('metadata')
      .eq('id', id)
      .eq('organization_id', orgId)
      .maybeSingle()

    if (!current) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 })
    }

    const existingMetadata: { [key: string]: Json | undefined } =
      (current as { metadata: { [key: string]: Json | undefined } | null }).metadata ?? {}

    const update: {
      status: DbStatus
      updated_at: string
      resolved_at?: string
      resolution_outcome?: ResolutionOutcome
      metadata?: Json
    } = {
      status: nextStatus,
      updated_at: new Date().toISOString(),
    }

    if (nextStatus === 'resolved') {
      update.resolved_at = new Date().toISOString()
      update.resolution_outcome = body.resolutionOutcome ?? 'compromise'
    }

    if (nextStatus === 'escalated' && body.escalateReason) {
      update.metadata = {
        ...existingMetadata,
        escalate_reason: body.escalateReason.trim(),
        escalated_at: new Date().toISOString(),
      }
    }

    const { error } = await supabase
      .from('litigation_workflows')
      .update(update)
      .eq('id', id)
      .eq('organization_id', orgId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (body.regenerate) {
    // Best-effort : déclenche l'Edge Function IA si configurée. Échec ignoré
    // (l'UI peut re-tenter via /api/litigation/draft-response/:id).
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (supabaseUrl) {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (token) {
        try {
          await fetch(`${supabaseUrl}/functions/v1/litigation-ai`, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ litigationId: id, regenerate: true }),
          })
        } catch {
          // ignoré — l'UI re-tentera.
        }
      }
    }
  }

  const out = await load(supabase, orgId, id)
  if (!out) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json(out)
}
