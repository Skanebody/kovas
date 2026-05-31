/**
 * KOVAS — Récupération du litige actif pour une mission (si existe).
 *
 * GET /api/litigation/by-mission/[missionId]
 *
 * Source de vérité : table `litigation_workflows` (migration 20260525121000).
 * La plainte du client est lue dans `notes` (copie dans
 * `metadata.client_complaint`) ; le brouillon IA dans `metadata.draft`.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
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

/** Extrait le bloc `metadata.draft` de façon défensive. */
function readDraft(metadata: Record<string, unknown> | null): DraftMetadata {
  if (!metadata || typeof metadata.draft !== 'object' || metadata.draft === null) {
    return {}
  }
  return metadata.draft as DraftMetadata
}

/** Plainte du client : `notes` en priorité, sinon `metadata.client_complaint`. */
function readReason(row: LitigationWorkflowRow): string {
  if (row.notes && row.notes.trim().length > 0) return row.notes
  if (row.metadata && typeof row.metadata.client_complaint === 'string') {
    return row.metadata.client_complaint
  }
  return ''
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ missionId: string }> },
): Promise<Response> {
  const { missionId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(missionId)) {
    return NextResponse.json({ error: 'invalid_mission_id' }, { status: 400 })
  }

  try {
    const { orgId, supabase } = await getCurrentUser()
    const { data } = await supabase
      .from('litigation_workflows')
      .select('id, status, opened_at, notes, metadata')
      .eq('mission_id', missionId)
      .eq('organization_id', orgId)
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const row = data as LitigationWorkflowRow | null
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })

    const draft = readDraft(row.metadata)
    const out: LitigationResponse = {
      id: row.id,
      status: row.status,
      openedAt: row.opened_at,
      reason: readReason(row),
      aiSuggestedResponse: draft.response_md ?? '',
      citedReferences: Array.isArray(draft.cited_references) ? draft.cited_references : [],
      draftGeneratedAt: draft.generated_at ?? null,
    }
    return NextResponse.json(out)
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
}
