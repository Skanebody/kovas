/**
 * KOVAS — Refonte page dossier : GET /api/dossiers/[id]/rooms
 *
 * Retourne :
 *  - visitedRooms : pièces déjà couvertes (depuis `dossier_rooms`) + compteurs photos/voice + statuts diagnostics
 *  - suggestedRooms : pièces probables non visitées (résolveur `detectSuggestedRooms`)
 *  - totalDuration : durée cumulée des sessions terrain (secondes)
 *
 * Authority : CLAUDE.md §3 (workflow pièces) + Partition B refonte page dossier.
 */

import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { type PropertyRoomEntry, detectSuggestedRooms } from '@/lib/dossier/room-mapping'
import type { SuggestedRoom, VisitedRoom } from '@/lib/dossier/types'
import { missionTypesToActiveDiagnostics } from '@/lib/mission/diagnostic-mapper'

export const runtime = 'nodejs'

interface SuccessBody {
  /**
   * `SuggestedRoomWithIcon` est compatible structurellement avec `SuggestedRoom`
   * (champ optionnel `iconName` en plus). Côté UI on peut ignorer ce champ ou
   * l'utiliser pour rendre une icône Lucide via `resolveRoomIcon`.
   */
  visitedRooms: VisitedRoom[]
  suggestedRooms: SuggestedRoom[]
  /** Durée cumulée des sessions terrain (secondes). */
  totalDuration: number
}

interface ErrorBody {
  error: string
}

interface DossierRoomRow {
  id: string
  name: string
  room_type: string | null
  position: number | null
  created_at: string
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<SuccessBody | ErrorBody>> {
  const { id } = await params

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'dossierId must be a UUID' }, { status: 400 })
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

  // 1. Dossier (incl. property_rooms snapshot)
  // property_rooms est ajouté par la migration 20260521150000_dossier_refonte
  // et n'est pas encore typé dans Database — on caste défensivement.
  const { data: dossierRaw, error: dossierErr } = await supabase
    .from('dossiers')
    .select('id, property_rooms')
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
    property_rooms: PropertyRoomEntry[] | null
  }

  // 2. Visited rooms (dossier_rooms)
  const { data: roomsRaw, error: roomsErr } = await supabase
    .from('dossier_rooms')
    .select('id, name, room_type, position, created_at')
    .eq('dossier_id', id)
    .eq('organization_id', orgId)
    .order('position', { ascending: true })

  if (roomsErr) {
    return NextResponse.json(
      { error: `dossier_rooms query : ${roomsErr.message}` },
      { status: 500 },
    )
  }
  const rooms = (roomsRaw ?? []) as unknown as DossierRoomRow[]
  const visitedRoomIds = rooms.map((r) => r.id)
  const visitedRoomTypes = new Set<string>(
    rooms.map((r) => (r.room_type ?? '').toLowerCase().trim()).filter((t) => t.length > 0),
  )

  // 3. Compteurs photos + voice par pièce
  type CountRow = { room_id: string | null }

  const [photosCountRes, voiceCountRes] = await Promise.all([
    visitedRoomIds.length === 0
      ? Promise.resolve({ data: [] as CountRow[], error: null })
      : supabase
          .from('photos')
          .select('room_id')
          .eq('dossier_id', id)
          .eq('organization_id', orgId)
          .in('room_id', visitedRoomIds),
    visitedRoomIds.length === 0
      ? Promise.resolve({ data: [] as CountRow[], error: null })
      : supabase
          .from('voice_notes')
          .select('room_id')
          .eq('dossier_id', id)
          .eq('organization_id', orgId)
          .in('room_id', visitedRoomIds),
  ])

  if (photosCountRes.error) {
    return NextResponse.json(
      { error: `photos query : ${photosCountRes.error.message}` },
      { status: 500 },
    )
  }
  if (voiceCountRes.error) {
    return NextResponse.json(
      { error: `voice_notes query : ${voiceCountRes.error.message}` },
      { status: 500 },
    )
  }

  const photoCountByRoom = new Map<string, number>()
  for (const row of (photosCountRes.data ?? []) as CountRow[]) {
    if (!row.room_id) continue
    photoCountByRoom.set(row.room_id, (photoCountByRoom.get(row.room_id) ?? 0) + 1)
  }
  const voiceCountByRoom = new Map<string, number>()
  for (const row of (voiceCountRes.data ?? []) as CountRow[]) {
    if (!row.room_id) continue
    voiceCountByRoom.set(row.room_id, (voiceCountByRoom.get(row.room_id) ?? 0) + 1)
  }

  // 4. Sessions terrain → durée totale (secondes)
  const { data: sessionsRaw, error: sessionsErr } = await supabase
    .from('mission_sessions' as never)
    .select('started_at, ended_at, paused_at, duration_seconds')
    .eq('dossier_id', id)
    .eq('organization_id', orgId)

  if (sessionsErr) {
    return NextResponse.json(
      { error: `mission_sessions query : ${sessionsErr.message}` },
      { status: 500 },
    )
  }
  type SessionRow = {
    started_at: string
    ended_at: string | null
    paused_at: string | null
    duration_seconds: number | null
  }
  const sessions = (sessionsRaw ?? []) as unknown as SessionRow[]
  let totalDurationSec = 0
  const nowMs = Date.now()
  for (const s of sessions) {
    if (typeof s.duration_seconds === 'number' && s.duration_seconds > 0) {
      totalDurationSec += s.duration_seconds
      continue
    }
    const startMs = new Date(s.started_at).getTime()
    const endRef = s.ended_at
      ? new Date(s.ended_at).getTime()
      : s.paused_at
        ? new Date(s.paused_at).getTime()
        : nowMs
    if (Number.isFinite(startMs) && Number.isFinite(endRef) && endRef > startMs) {
      totalDurationSec += Math.round((endRef - startMs) / 1000)
    }
  }

  // 5. Diagnostics actifs (pour suggested rooms)
  const { data: missionsRaw, error: missionsErr } = await supabase
    .from('missions')
    .select('type')
    .eq('dossier_id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)

  if (missionsErr) {
    return NextResponse.json({ error: `missions query : ${missionsErr.message}` }, { status: 500 })
  }
  const activeDiagnostics = missionTypesToActiveDiagnostics(
    (missionsRaw ?? []).map((m) => m.type as string),
  )

  // 6. Construit visitedRooms (status par défaut = in-progress si compteurs > 0)
  const visitedRooms: VisitedRoom[] = rooms.map((r) => {
    const photosCount = photoCountByRoom.get(r.id) ?? 0
    const voiceNotesCount = voiceCountByRoom.get(r.id) ?? 0
    return {
      id: r.id,
      name: r.name,
      type: r.room_type ?? 'autres',
      // Statut : si la pièce a des captures => 'in-progress' ; sinon 'started'.
      // 'completed' / 'skipped' nécessitent une logique métier que la partition A
      // produira (cross-check field_values requis vs collectés). On reste neutre ici.
      status: photosCount > 0 || voiceNotesCount > 0 ? 'in-progress' : 'started',
      photosCount,
      voiceNotesCount,
      // durée par pièce non encore trackée granulairement — placeholder 0.
      durationMin: 0,
      fieldsCount: photosCount + voiceNotesCount,
      diagnosticStatuses: [],
    }
  })

  // 7. Suggested rooms — résolveur synchrone
  const suggestedRooms = detectSuggestedRooms(
    { property_rooms: dossier.property_rooms },
    visitedRoomTypes,
    activeDiagnostics,
  )

  return NextResponse.json({
    visitedRooms,
    suggestedRooms,
    totalDuration: totalDurationSec,
  })
}
