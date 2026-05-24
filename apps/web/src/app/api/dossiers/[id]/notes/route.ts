/**
 * KOVAS — API route : capture d'une note texte mode Capture silencieuse (MISSION-H).
 *
 * POST /api/dossiers/[id]/notes
 * Body : { sessionId, text, roomId, source: 'voice'|'text' }
 *
 * Persiste dans `mission_text_notes` (table créée par migration capture_first).
 * Best-effort : 200 vide en cas d'erreur RLS / table absente (le state UI local
 * reste la source de vérité — la finalize-analysis va relire tout ce qui est
 * dispo en DB de toutes façons).
 *
 * Authority : brief MISSION-H lot 1.
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

  let body: { sessionId?: string; text?: string; roomId?: string | null; source?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  if (!body.text || typeof body.text !== 'string' || body.text.trim().length === 0) {
    return NextResponse.json({ error: 'text required' }, { status: 400 })
  }

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

  // Insert direct dans mission_text_notes (table capture_first, pas dans le type généré)
  const { error } = await supabase.from('mission_text_notes' as never).insert({
    organization_id: orgId,
    dossier_id: dossierId,
    mission_session_id: body.sessionId ?? null,
    room_id: body.roomId ?? null,
    text: body.text.trim(),
    source: body.source ?? 'text',
    created_by: userId,
  } as never)

  if (error) {
    // Non bloquant — on log mais on renvoie 200 pour ne pas casser le flow terrain.
    console.warn('[dossiers/notes] insert failed (non blocking)', error.message)
    return NextResponse.json({ ok: false, soft_error: error.message })
  }

  return NextResponse.json({ ok: true })
}
