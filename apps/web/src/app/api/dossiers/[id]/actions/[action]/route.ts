/**
 * KOVAS — Refonte page dossier : POST /api/dossiers/[id]/actions/[action]
 *
 * Dispatch les actions du workflow dossier en mode POST unifié.
 *
 * Actions supportées :
 *   - start_mission   : INSERT mission_session + UPDATE dossiers.mission_started_at (+status='on_site')
 *   - pause_mission   : UPDATE active session.paused_at = now()
 *   - resume_mission  : UPDATE active session.paused_at = null
 *   - cancel_mission  : UPDATE session.ended_at + dossiers.status='cancelled'
 *   - finish_mission  : termine la session active + dossiers.status='done' (SANS validated_at)
 *                       → résout l'état conceptuel 'a_valider' (cf. lib/dossier/states.ts L75).
 *                       Distinct de 'validate' qui pose validated_at → état 'valide'.
 *                       Déclenché par le tchat mission ("Terminer la mission").
 *   - validate        : UPDATE dossiers.validated_at + status='done'
 *                       (note : le brief mentionnait 'exported' mais le CHECK de dossiers.status
 *                        n'autorise que 'done' / 'archived' post-validation ; on respecte la BDD)
 *   - reopen          : UPDATE dossiers.validated_at=null + status='back_office'
 *   - archive         : UPDATE dossiers.status='archived'
 *   - request_docs    : no-op stub V1 (sera implémenté avec emails clients plus tard)
 *
 * Authority : CLAUDE.md §3 (workflow dossier) + Partition B refonte page dossier.
 */

import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'

const SUPPORTED_ACTIONS = [
  'start_mission',
  'pause_mission',
  'resume_mission',
  'cancel_mission',
  'finish_mission',
  'validate',
  'reopen',
  'archive',
  'request_docs',
] as const
type DossierAction = (typeof SUPPORTED_ACTIONS)[number]

interface OkBody {
  ok: true
  action: DossierAction
  /** Champs optionnels : id de session affectée, status atteint, etc. */
  sessionId?: string
  status?: string
  message?: string
}

interface ErrorBody {
  ok: false
  error: string
}

type SupabaseLike = Awaited<ReturnType<typeof getCurrentUser>>['supabase']

interface MissionSessionRow {
  id: string
  started_at: string
  paused_at: string | null
  ended_at: string | null
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; action: string }> },
): Promise<NextResponse<OkBody | ErrorBody>> {
  const { id, action } = await params

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: 'dossierId must be a UUID' }, { status: 400 })
  }

  if (!(SUPPORTED_ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json(
      { ok: false, error: `Unsupported action : ${action}` },
      { status: 400 },
    )
  }
  const typedAction = action as DossierAction

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

  // RLS check + récupère la dernière session active pour les actions qui en dépendent.
  const { data: dossier, error: dossierErr } = await supabase
    .from('dossiers')
    .select('id, status')
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
  if (!dossier) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 })
  }

  let result: OkBody | ErrorBody
  try {
    switch (typedAction) {
      case 'start_mission':
        result = await handleStartMission(supabase, orgId, userId, id)
        break
      case 'pause_mission':
        result = await handlePauseMission(supabase, orgId, id)
        break
      case 'resume_mission':
        result = await handleResumeMission(supabase, orgId, id)
        break
      case 'cancel_mission':
        result = await handleCancelMission(supabase, orgId, id)
        break
      case 'finish_mission':
        result = await handleFinishMission(supabase, orgId, id)
        break
      case 'validate':
        result = await handleValidate(supabase, orgId, id)
        break
      case 'reopen':
        result = await handleReopen(supabase, orgId, id)
        break
      case 'archive':
        result = await handleArchive(supabase, orgId, id)
        break
      case 'request_docs':
        result = {
          ok: true,
          action: 'request_docs',
          message:
            'request_docs : no-op V1 — la fonctionnalité email client sera livrée dans une itération ultérieure.',
        }
        break
      default:
        // Exhaustivité du switch garantie par DossierAction — defensive.
        result = { ok: false, error: `Unhandled action : ${typedAction}` }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'action failed'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 })
  }

  // Revalidation des pages impactées
  revalidatePath(`/dashboard/dossiers/${id}`)
  revalidatePath('/dashboard/dossiers')
  revalidatePath('/dashboard/dashboard')

  return NextResponse.json(result)
}

// ============================================
// Handlers
// ============================================

async function handleStartMission(
  supabase: SupabaseLike,
  orgId: string,
  userId: string,
  dossierId: string,
): Promise<OkBody | ErrorBody> {
  // Garde-fou : refuse de re-démarrer si une session active existe déjà.
  const active = await getActiveSession(supabase, orgId, dossierId)
  if (active) {
    return {
      ok: false,
      error: 'Une session terrain est déjà en cours sur ce dossier — utilisez resume ou cancel.',
    }
  }

  const nowIso = new Date().toISOString()

  // INSERT mission_session (la table n'est pas dans le type Database généré → as never).
  const { data: insertedRaw, error: insertErr } = await supabase
    .from('mission_sessions' as never)
    .insert({
      organization_id: orgId,
      dossier_id: dossierId,
      started_at: nowIso,
      created_by: userId,
    } as never)
    .select('id')
    .single()

  if (insertErr) {
    return { ok: false, error: `mission_sessions insert : ${insertErr.message}` }
  }
  const session = insertedRaw as unknown as { id: string }

  // UPDATE dossiers — mission_started_at est posé uniquement la première fois
  // (résolveur d'état). Status passe en 'on_site' (CHECK constraint).
  const { error: updErr } = await supabase
    .from('dossiers')
    .update({
      mission_started_at: nowIso,
      status: 'on_site',
      started_at: nowIso,
    } as never)
    .eq('id', dossierId)
    .eq('organization_id', orgId)
    .is('mission_started_at', null)

  // Si mission_started_at existait déjà (resume après re-start après cancel),
  // on update juste le status sans toucher mission_started_at.
  if (updErr) {
    return { ok: false, error: `dossier update : ${updErr.message}` }
  }

  // Idempotence : on force status='on_site' même si mission_started_at était déjà set.
  const { error: statusErr } = await supabase
    .from('dossiers')
    .update({ status: 'on_site' } as never)
    .eq('id', dossierId)
    .eq('organization_id', orgId)

  if (statusErr) {
    return { ok: false, error: `dossier status update : ${statusErr.message}` }
  }

  return { ok: true, action: 'start_mission', sessionId: session.id, status: 'on_site' }
}

async function handlePauseMission(
  supabase: SupabaseLike,
  orgId: string,
  dossierId: string,
): Promise<OkBody | ErrorBody> {
  const active = await getActiveSession(supabase, orgId, dossierId)
  if (!active) {
    return { ok: false, error: 'Aucune session active à mettre en pause.' }
  }
  if (active.paused_at) {
    return {
      ok: true,
      action: 'pause_mission',
      sessionId: active.id,
      message: 'Session déjà en pause — no-op.',
    }
  }

  const { error } = await supabase
    .from('mission_sessions' as never)
    .update({ paused_at: new Date().toISOString() } as never)
    .eq('id', active.id)
    .eq('organization_id', orgId)

  if (error) {
    return { ok: false, error: `mission_sessions pause : ${error.message}` }
  }
  return { ok: true, action: 'pause_mission', sessionId: active.id }
}

async function handleResumeMission(
  supabase: SupabaseLike,
  orgId: string,
  dossierId: string,
): Promise<OkBody | ErrorBody> {
  const active = await getActiveSession(supabase, orgId, dossierId)
  if (!active) {
    return { ok: false, error: 'Aucune session active à reprendre.' }
  }
  if (!active.paused_at) {
    return {
      ok: true,
      action: 'resume_mission',
      sessionId: active.id,
      message: 'Session déjà active — no-op.',
    }
  }

  const { error } = await supabase
    .from('mission_sessions' as never)
    .update({ paused_at: null } as never)
    .eq('id', active.id)
    .eq('organization_id', orgId)

  if (error) {
    return { ok: false, error: `mission_sessions resume : ${error.message}` }
  }
  return { ok: true, action: 'resume_mission', sessionId: active.id }
}

async function handleCancelMission(
  supabase: SupabaseLike,
  orgId: string,
  dossierId: string,
): Promise<OkBody | ErrorBody> {
  const active = await getActiveSession(supabase, orgId, dossierId)
  const nowIso = new Date().toISOString()

  // Si une session active existe : on la termine. Sinon on continue (cancel pur du dossier).
  if (active) {
    const { error } = await supabase
      .from('mission_sessions' as never)
      .update({ ended_at: nowIso } as never)
      .eq('id', active.id)
      .eq('organization_id', orgId)

    if (error) {
      return { ok: false, error: `mission_sessions cancel : ${error.message}` }
    }
  }

  const { error: dossierErr } = await supabase
    .from('dossiers')
    .update({ status: 'cancelled' } as never)
    .eq('id', dossierId)
    .eq('organization_id', orgId)

  if (dossierErr) {
    return { ok: false, error: `dossier cancel : ${dossierErr.message}` }
  }

  return {
    ok: true,
    action: 'cancel_mission',
    status: 'cancelled',
    sessionId: active?.id,
  }
}

async function handleFinishMission(
  supabase: SupabaseLike,
  orgId: string,
  dossierId: string,
): Promise<OkBody | ErrorBody> {
  // Termine la session terrain active (si elle existe) puis bascule le dossier
  // en status='done'. On ne pose PAS validated_at : l'état conceptuel résolu
  // devient 'a_valider' (cf. lib/dossier/states.ts L75) — le diagnostiqueur
  // valide ensuite manuellement depuis le hub. completed_at marque la fin terrain.
  const active = await getActiveSession(supabase, orgId, dossierId)
  const nowIso = new Date().toISOString()

  if (active && !active.ended_at) {
    const { error } = await supabase
      .from('mission_sessions' as never)
      .update({ ended_at: nowIso } as never)
      .eq('id', active.id)
      .eq('organization_id', orgId)

    if (error) {
      return { ok: false, error: `mission_sessions finish : ${error.message}` }
    }
  }

  const { error } = await supabase
    .from('dossiers')
    .update({
      completed_at: nowIso,
      status: 'done',
    } as never)
    .eq('id', dossierId)
    .eq('organization_id', orgId)

  if (error) {
    return { ok: false, error: `dossier finish : ${error.message}` }
  }

  return {
    ok: true,
    action: 'finish_mission',
    status: 'done',
    sessionId: active?.id,
  }
}

async function handleValidate(
  supabase: SupabaseLike,
  orgId: string,
  dossierId: string,
): Promise<OkBody | ErrorBody> {
  // Termine d'abord toute session active (sécurité workflow).
  const active = await getActiveSession(supabase, orgId, dossierId)
  const nowIso = new Date().toISOString()

  if (active && !active.ended_at) {
    await supabase
      .from('mission_sessions' as never)
      .update({ ended_at: nowIso } as never)
      .eq('id', active.id)
      .eq('organization_id', orgId)
  }

  // status='done' (le CHECK constraint n'autorise pas 'exported' — voir header).
  const { error } = await supabase
    .from('dossiers')
    .update({
      validated_at: nowIso,
      completed_at: nowIso,
      status: 'done',
    } as never)
    .eq('id', dossierId)
    .eq('organization_id', orgId)

  if (error) {
    return { ok: false, error: `dossier validate : ${error.message}` }
  }
  return { ok: true, action: 'validate', status: 'done' }
}

async function handleReopen(
  supabase: SupabaseLike,
  orgId: string,
  dossierId: string,
): Promise<OkBody | ErrorBody> {
  const { error } = await supabase
    .from('dossiers')
    .update({
      validated_at: null,
      status: 'back_office',
    } as never)
    .eq('id', dossierId)
    .eq('organization_id', orgId)

  if (error) {
    return { ok: false, error: `dossier reopen : ${error.message}` }
  }
  return { ok: true, action: 'reopen', status: 'back_office' }
}

async function handleArchive(
  supabase: SupabaseLike,
  orgId: string,
  dossierId: string,
): Promise<OkBody | ErrorBody> {
  const { error } = await supabase
    .from('dossiers')
    .update({ status: 'archived' } as never)
    .eq('id', dossierId)
    .eq('organization_id', orgId)

  if (error) {
    return { ok: false, error: `dossier archive : ${error.message}` }
  }
  return { ok: true, action: 'archive', status: 'archived' }
}

// ============================================
// Helpers
// ============================================

/**
 * Récupère la session active (ended_at IS NULL) la plus récente d'un dossier.
 * Retourne null si aucune session active.
 */
async function getActiveSession(
  supabase: SupabaseLike,
  orgId: string,
  dossierId: string,
): Promise<MissionSessionRow | null> {
  const { data, error } = await supabase
    .from('mission_sessions' as never)
    .select('id, started_at, paused_at, ended_at')
    .eq('dossier_id', dossierId)
    .eq('organization_id', orgId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    // maybeSingle ne throw pas sur 0 row, donc une erreur ici est réelle.
    throw new Error(`mission_sessions query : ${error.message}`)
  }
  return (data ?? null) as unknown as MissionSessionRow | null
}
