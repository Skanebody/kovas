/**
 * KOVAS — API route : capture_mode d'une session mission (MISSION-H).
 *
 * GET  → lit mission_sessions.captured_data.capture_mode (défaut 'conversation')
 * PATCH → met à jour capture_mode dans captured_data jsonb
 *
 * Authority : brief MISSION-H lot 1 + CLAUDE.md §3.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

type CaptureMode = 'capture' | 'conversation'

function isCaptureMode(v: unknown): v is CaptureMode {
  return v === 'capture' || v === 'conversation'
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
): Promise<NextResponse> {
  const { id: dossierId, sessionId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(sessionId) || !/^[0-9a-f-]{36}$/i.test(dossierId)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
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

  const { data, error } = await supabase
    .from('mission_sessions')
    .select('captured_data')
    .eq('id', sessionId)
    .eq('dossier_id', dossierId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'session not found' }, { status: 404 })

  const captured = isRecord(data.captured_data) ? data.captured_data : {}
  // Défaut 'conversation' (basculé le 2026-05-30) : sans préférence explicite,
  // l'assistant doit répondre au vocal et au texte. Le mode 'capture' silencieux
  // reste accessible via le toggle pour le terrain offline.
  const mode = isCaptureMode(captured.capture_mode) ? captured.capture_mode : 'conversation'

  return NextResponse.json({ capture_mode: mode })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> },
): Promise<NextResponse> {
  const { id: dossierId, sessionId } = await params
  if (!/^[0-9a-f-]{36}$/i.test(sessionId) || !/^[0-9a-f-]{36}$/i.test(dossierId)) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  }

  let body: { capture_mode?: unknown }
  try {
    body = (await request.json()) as { capture_mode?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  if (!isCaptureMode(body.capture_mode)) {
    return NextResponse.json(
      { error: 'capture_mode must be "capture" or "conversation"' },
      {
        status: 400,
      },
    )
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

  // Charge le captured_data actuel pour merge non destructif
  const { data: current, error: readErr } = await supabase
    .from('mission_sessions')
    .select('captured_data')
    .eq('id', sessionId)
    .eq('dossier_id', dossierId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })
  if (!current) return NextResponse.json({ error: 'session not found' }, { status: 404 })

  const merged = {
    ...(isRecord(current.captured_data) ? current.captured_data : {}),
    capture_mode: body.capture_mode,
  }

  const { error: updErr } = await supabase
    .from('mission_sessions')
    .update({ captured_data: merged })
    .eq('id', sessionId)
    .eq('dossier_id', dossierId)
    .eq('organization_id', orgId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, capture_mode: body.capture_mode })
}
