/**
 * KOVAS — API route : capture d'une note texte mode Capture silencieuse (MISSION-H).
 *
 * POST /api/dossiers/[id]/notes
 * Body : { sessionId, text, roomId, source: 'voice'|'text', clientLocalId? }
 *
 * Persiste dans `mission_text_notes` (table créée par migration capture_first).
 *
 * BUG 1 (audit terrain réseau instable) :
 *   Le client (queue Dexie mission-notes-offline-store) fournit désormais un
 *   `clientLocalId` (UUID local). On passe d'un .insert() best-effort SANS clef
 *   à un .upsert() idempotent sur (dossier_id, client_local_id) — un rejeu de
 *   sync (réponse réseau perdue après un INSERT réussi) retombe sur la même
 *   ligne au lieu de créer un doublon. Migration :
 *   20260528110000_mission_notes_idempotency.sql (ADD COLUMN + UNIQUE INDEX).
 *
 *   Compat : si `clientLocalId` absent (ancien client), on retombe sur un INSERT
 *   classique (comportement legacy préservé).
 *
 * On renvoie l'id serveur (textNoteId) pour permettre au manager de sync de
 * marquer la note 'synced' côté Dexie. En cas d'erreur RLS / table absente, on
 * renvoie un statut explicite (le manager gardera la note en retry — la perte
 * n'est plus silencieuse comme avant).
 *
 * Authority : brief MISSION-H lot 1 + brief BUG 1.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id: dossierId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(dossierId)) {
    return NextResponse.json({ error: 'invalid dossierId' }, { status: 400 })
  }

  let body: {
    sessionId?: string
    text?: string
    roomId?: string | null
    source?: string
    clientLocalId?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  if (!body.text || typeof body.text !== 'string' || body.text.trim().length === 0) {
    return NextResponse.json({ error: 'text required' }, { status: 400 })
  }

  // roomId : la colonne mission_text_notes.room_id est un UUID dossier_rooms.
  // Les pièces locales (slug `ai-...`, `salon`, etc.) ne sont pas des UUID DB →
  // on ne les passe pas en room_id (FK invalide). Best-effort : note rattachée
  // au dossier, room_id null (la consolidation finale réassocie au besoin).
  const roomId =
    typeof body.roomId === 'string' && /^[0-9a-f-]{36}$/i.test(body.roomId) ? body.roomId : null

  const clientLocalId =
    typeof body.clientLocalId === 'string' && body.clientLocalId.length > 0
      ? body.clientLocalId
      : null

  let orgId: string
  let userId: string
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    orgId = u.orgId
    userId = u.user.id
    supabase = u.supabase
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Insert / upsert dans mission_text_notes. La colonne client_local_id est
  // ajoutée par la migration BUG 1 (pas encore dans les types générés) → on
  // cast `as never` localement, comme le reste de ce fichier pour cette table.
  const insertPayload = {
    organization_id: orgId,
    dossier_id: dossierId,
    room_id: roomId,
    text: body.text.trim(),
    created_by: userId,
    client_local_id: clientLocalId,
  }

  // Avec clef d'idempotence → upsert onConflict (dossier_id, client_local_id).
  // Sans clef (legacy) → insert classique.
  const query = clientLocalId
    ? supabase.from('mission_text_notes' as never).upsert(insertPayload as never, {
        onConflict: 'dossier_id,client_local_id',
        ignoreDuplicates: false,
      })
    : supabase.from('mission_text_notes' as never).insert(insertPayload as never)

  const { data: row, error } = await query.select('id').single()

  if (error || !row) {
    // On renvoie un 200 avec soft_error mais SANS ok:true — le manager de sync
    // ne marquera donc PAS la note 'synced' et la gardera en retry (plus de
    // perte silencieuse comme avec l'ancien .catch() vide côté client).
    console.warn('[dossiers/notes] upsert failed', error?.message)
    return NextResponse.json({ ok: false, soft_error: error?.message ?? 'no row returned' })
  }

  return NextResponse.json({ ok: true, textNoteId: (row as { id: string }).id })
}
