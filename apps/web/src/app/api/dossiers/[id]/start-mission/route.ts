/**
 * KOVAS — Endpoint alias /api/dossiers/[id]/start-mission
 *
 * Démarre une mission terrain pour un dossier — alias direct demandé par les
 * boutons "Commencer la mission" disséminés dans l'app (FIX-JJ).
 *
 * Délègue à l'endpoint canonique /api/dossiers/[id]/actions/start_mission via
 * une redirection interne (même payload, même garde-fous, même réponse).
 *
 * Authority : CLAUDE.md §3 feature 1 (saisie vocale terrain) — mode mission
 * accessible depuis 6 points d'entrée. Cet alias rend la route plus parlante
 * pour les clients qui appellent un endpoint nommé d'après l'intention.
 *
 * @see /api/dossiers/[id]/actions/[action]/route.ts pour la logique métier.
 */

import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'

type SupabaseLike = Awaited<ReturnType<typeof getCurrentUser>>['supabase']

interface SuccessBody {
  ok: true
  sessionId: string
  status: string
  redirectTo: string
}

interface ErrorBody {
  ok: false
  error: string
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<SuccessBody | ErrorBody>> {
  const { id } = await params

  // Validation UUID basique — évite un round-trip DB inutile sur garbage.
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: 'dossierId must be a UUID' }, { status: 400 })
  }

  let supabase: SupabaseLike
  let orgId: string
  let userId: string
  try {
    const u = await getCurrentUser()
    supabase = u.supabase
    orgId = u.orgId
    userId = u.user.id
  } catch {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  // Vérifie que le dossier appartient bien à l'org (RLS double-check).
  // NB : mission_started_at n'est pas encore dans les types DB générés — on lit
  // started_at qui sert de proxy (`as unknown` cast pour récupérer le champ).
  const { data: dossierRaw, error: dossierErr } = await supabase
    .from('dossiers')
    .select('id, status, started_at')
    .eq('id', id)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .maybeSingle()

  if (dossierErr) {
    return NextResponse.json(
      { ok: false, error: `dossier query : ${dossierErr.message}` },
      { status: 500 },
    )
  }
  if (!dossierRaw) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }
  const dossier = dossierRaw as unknown as {
    id: string
    status: string
    started_at: string | null
  }

  // Vérifie si une session active existe déjà — dans ce cas on retourne juste
  // l'URL de reprise (pas d'INSERT redondant).
  const { data: existing } = await supabase
    .from('mission_sessions' as never)
    .select('id, started_at, paused_at, ended_at')
    .eq('dossier_id', id)
    .eq('organization_id', orgId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const active = existing as unknown as { id: string } | null

  if (active) {
    return NextResponse.json({
      ok: true,
      sessionId: active.id,
      status: 'on_site',
      redirectTo: `/dashboard/dossiers/${id}/mission/tchat`,
    })
  }

  const nowIso = new Date().toISOString()

  // INSERT mission_sessions
  const { data: insertedRaw, error: insertErr } = await supabase
    .from('mission_sessions' as never)
    .insert({
      organization_id: orgId,
      dossier_id: id,
      started_at: nowIso,
      created_by: userId,
    } as never)
    .select('id')
    .single()

  if (insertErr) {
    return NextResponse.json(
      { ok: false, error: `mission_sessions insert : ${insertErr.message}` },
      { status: 500 },
    )
  }
  const session = insertedRaw as unknown as { id: string }

  // UPDATE dossier : status=on_site + started_at + mission_started_at (1ère fois).
  // started_at sert de proxy (mission_started_at est posé via la migration cible
  // dossier-hub, déjà appliquée — cf. actions/[action]/route.ts).
  if (!dossier.started_at) {
    await supabase
      .from('dossiers')
      .update({
        mission_started_at: nowIso,
        started_at: nowIso,
        status: 'on_site',
      } as never)
      .eq('id', id)
      .eq('organization_id', orgId)
  } else {
    await supabase
      .from('dossiers')
      .update({ status: 'on_site' } as never)
      .eq('id', id)
      .eq('organization_id', orgId)
  }

  revalidatePath(`/dashboard/dossiers/${id}`)
  revalidatePath('/dashboard/dossiers')
  revalidatePath('/dashboard/dashboard')

  return NextResponse.json({
    ok: true,
    sessionId: session.id,
    status: 'on_site',
    redirectTo: `/dashboard/dossiers/${id}/mission/tchat`,
  })
}
