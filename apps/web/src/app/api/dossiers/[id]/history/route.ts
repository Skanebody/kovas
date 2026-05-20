/**
 * KOVAS — Refonte page dossier : GET /api/dossiers/[id]/history
 *
 * Construit la timeline du dossier à partir de plusieurs sources :
 *   - dossiers (created_at, mission_started_at, validated_at, status)
 *   - mission_sessions (started_at, paused_at, ended_at)
 *   - photos.created_at → 'photo_added'
 *   - voice_notes.created_at → 'voice_added'
 *   - dossier_field_values.manually_edited_at → 'field_edited'
 *   - dossier_exports.created_at → 'exported'
 *
 * Pagination : ?limit=20&before=<timestamp ISO>.
 *
 * Authority : CLAUDE.md §3 + Partition B refonte page dossier.
 */

import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { type DossierHistoryInput, buildDossierHistory } from '@/lib/dossier/history-formatter'
import type { HistoryItem } from '@/lib/dossier/types'

export const runtime = 'nodejs'

interface SuccessBody {
  items: HistoryItem[]
  hasMore: boolean
}

interface ErrorBody {
  error: string
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<SuccessBody | ErrorBody>> {
  const { id } = await params

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'dossierId must be a UUID' }, { status: 400 })
  }

  // Query params
  const url = new URL(request.url)
  const limitParam = url.searchParams.get('limit')
  const before = url.searchParams.get('before') ?? undefined

  let limit = DEFAULT_LIMIT
  if (limitParam) {
    const parsed = Number.parseInt(limitParam, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, MAX_LIMIT)
    }
  }

  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  let orgId: string
  try {
    const u = await getCurrentUser()
    supabase = u.supabase
    orgId = u.orgId
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 1. Dossier (incl. timestamps refonte)
  const { data: dossierRaw, error: dossierErr } = await supabase
    .from('dossiers')
    .select('id, status, created_at, mission_started_at, validated_at')
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (dossierErr) {
    return NextResponse.json({ error: `dossier query : ${dossierErr.message}` }, { status: 500 })
  }
  if (!dossierRaw) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const dossier = dossierRaw as unknown as {
    id: string
    status: string
    created_at: string
    mission_started_at: string | null
    validated_at: string | null
  }

  // 2. mission_sessions
  const { data: sessionsRaw, error: sessionsErr } = await supabase
    .from('mission_sessions' as never)
    .select('id, started_at, paused_at, ended_at')
    .eq('dossier_id', id)
    .eq('organization_id', orgId)
    .order('started_at', { ascending: false })

  if (sessionsErr) {
    return NextResponse.json(
      { error: `mission_sessions query : ${sessionsErr.message}` },
      { status: 500 },
    )
  }
  type SessionRow = {
    id: string
    started_at: string
    paused_at: string | null
    ended_at: string | null
  }
  const sessions = (sessionsRaw ?? []) as unknown as SessionRow[]

  // 3. photos
  const { data: photosRaw, error: photosErr } = await supabase
    .from('photos')
    .select('id, created_at, room_id')
    .eq('dossier_id', id)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (photosErr) {
    return NextResponse.json({ error: `photos query : ${photosErr.message}` }, { status: 500 })
  }
  const photos = (photosRaw ?? []) as unknown as Array<{
    id: string
    created_at: string
    room_id: string | null
  }>

  // 4. voice_notes
  const { data: voiceRaw, error: voiceErr } = await supabase
    .from('voice_notes')
    .select('id, created_at, room_id')
    .eq('dossier_id', id)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(200)

  if (voiceErr) {
    return NextResponse.json({ error: `voice_notes query : ${voiceErr.message}` }, { status: 500 })
  }
  const voiceNotes = (voiceRaw ?? []) as unknown as Array<{
    id: string
    created_at: string
    room_id: string | null
  }>

  // 5. field edits (manually_edited_at IS NOT NULL)
  const { data: fieldEditsRaw, error: fieldEditsErr } = await supabase
    .from('dossier_field_values' as never)
    .select('id, field_path, manually_edited_at')
    .eq('dossier_id', id)
    .eq('organization_id', orgId)
    .not('manually_edited_at', 'is', null)
    .order('manually_edited_at', { ascending: false })
    .limit(100)

  if (fieldEditsErr) {
    return NextResponse.json(
      { error: `dossier_field_values query : ${fieldEditsErr.message}` },
      { status: 500 },
    )
  }
  const fieldEdits = (fieldEditsRaw ?? []) as unknown as Array<{
    id: string
    field_path: string
    manually_edited_at: string | null
  }>

  // 6. exports
  const { data: exportsRaw, error: exportsErr } = await supabase
    .from('dossier_exports' as never)
    .select('id, destination, created_at, was_complete')
    .eq('dossier_id', id)
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (exportsErr) {
    return NextResponse.json(
      { error: `dossier_exports query : ${exportsErr.message}` },
      { status: 500 },
    )
  }
  const exports_ = (exportsRaw ?? []) as unknown as Array<{
    id: string
    destination: string
    created_at: string
    was_complete: boolean
  }>

  // 7. Construit l'input et délègue au formatter
  const input: DossierHistoryInput = {
    dossier: {
      id: dossier.id,
      created_at: dossier.created_at,
      mission_started_at: dossier.mission_started_at,
      validated_at: dossier.validated_at,
      status: dossier.status,
    },
    sessions: sessions.map((s) => ({
      id: s.id,
      started_at: s.started_at,
      paused_at: s.paused_at,
      ended_at: s.ended_at,
    })),
    photos: photos.map((p) => ({
      id: p.id,
      created_at: p.created_at,
      room_id: p.room_id,
    })),
    voiceNotes: voiceNotes.map((v) => ({
      id: v.id,
      created_at: v.created_at,
      room_id: v.room_id,
    })),
    fieldEdits: fieldEdits.map((f) => ({
      id: f.id,
      field_path: f.field_path,
      manually_edited_at: f.manually_edited_at,
    })),
    exports: exports_.map((e) => ({
      id: e.id,
      destination: e.destination,
      created_at: e.created_at,
      was_complete: e.was_complete,
    })),
  }

  const result = buildDossierHistory(input, { limit, before })

  return NextResponse.json({
    items: result.items,
    hasMore: result.hasMore,
  })
}
