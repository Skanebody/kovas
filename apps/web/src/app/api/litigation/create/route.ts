/**
 * KOVAS — Ouverture d'un litige sur une mission.
 *
 * POST /api/litigation/create  { missionId, litigationType?, reason }
 *
 * 1. Insère la row `litigation_workflows` (status = 'opened', opened_at = now).
 *    - `litigation_kind` (NOT NULL) dérivé du type de litige choisi côté UI,
 *      mappé vers les valeurs autorisées par le CHECK de la table.
 *    - La plainte du client est stockée dans `notes` + `metadata.client_complaint`,
 *      avec le type UI d'origine dans `metadata.ui_litigation_type`.
 * 2. Déclenche en best-effort la génération IA (Edge Function `litigation-ai`)
 *    — non bloquant : la régénération manuelle reste possible.
 * 3. La page litigation re-fetche `litigation_workflows` par mission après reload,
 *    on renvoie donc simplement l'id + le statut créés.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface CreateBody {
  missionId: string
  /** Type de litige choisi dans le formulaire (taxonomie UI). */
  litigationType?: string
  reason: string
}

/**
 * Valeurs autorisées par le CHECK `litigation_kind` de la table
 * `litigation_workflows` (cf. migration 20260525121000).
 */
type LitigationKind =
  | 'claim_client'
  | 'mediation'
  | 'rcp_insurer'
  | 'judicial'
  | 'administrative'
  | 'other'

/**
 * Mappe la taxonomie UI (motifs métier orientés diagnostic) vers la
 * taxonomie DB `litigation_kind`. Tous les motifs « techniques » relèvent
 * d'une réclamation client à ce stade ; les cas explicitement financiers
 * ou « autre » sont distingués. Défaut sûr : 'claim_client'.
 */
const UI_TYPE_TO_KIND: Record<string, LitigationKind> = {
  dpe_contestation: 'claim_client',
  erreur_surface_carrez: 'claim_client',
  oubli_diagnostic: 'claim_client',
  amiante_non_detecte: 'claim_client',
  plomb_non_detecte: 'claim_client',
  gaz_securite: 'claim_client',
  electricite_securite: 'claim_client',
  demande_remboursement: 'claim_client',
  autre: 'other',
}

function resolveKind(uiType: string | undefined): LitigationKind {
  if (!uiType) return 'claim_client'
  return UI_TYPE_TO_KIND[uiType] ?? 'claim_client'
}

export async function POST(request: Request): Promise<Response> {
  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  if (!body.missionId || !/^[0-9a-f-]{36}$/i.test(body.missionId)) {
    return NextResponse.json({ error: 'invalid_mission_id' }, { status: 400 })
  }
  if (typeof body.reason !== 'string' || body.reason.trim().length < 10) {
    return NextResponse.json({ error: 'reason_required' }, { status: 400 })
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

  const reason = body.reason.trim()
  const uiType = typeof body.litigationType === 'string' ? body.litigationType : undefined
  const litigationKind = resolveKind(uiType)
  const openedAt = new Date().toISOString()

  const { data: inserted, error: insErr } = await supabase
    .from('litigation_workflows')
    .insert({
      organization_id: orgId,
      mission_id: body.missionId,
      user_id: userId,
      litigation_kind: litigationKind,
      status: 'opened',
      opened_at: openedAt,
      notes: reason,
      metadata: {
        client_complaint: reason,
        ...(uiType ? { ui_litigation_type: uiType } : {}),
      },
    })
    .select('id, status, opened_at')
    .single()

  if (insErr || !inserted) {
    return NextResponse.json({ error: insErr?.message ?? 'insert_failed' }, { status: 500 })
  }

  const litigationId = inserted.id

  await supabase.from('audit_log' as never).insert({
    organization_id: orgId,
    user_id: userId,
    action: 'litigation.create',
    resource_type: 'litigation',
    resource_id: litigationId,
  } as never)

  // Best-effort : déclenche l'Edge Function de génération IA (réponse + juris).
  // Non bloquant — si elle échoue ou n'existe pas encore, la régénération
  // manuelle reste possible depuis l'UI.
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
          body: JSON.stringify({ litigationId, missionId: body.missionId, reason }),
        })
      } catch {
        // Silent — la régénération manuelle reste possible.
      }
    }
  }

  // La page litigation re-fetche `litigation_workflows` par mission après
  // `window.location.reload()` côté form → l'id + statut suffisent ici.
  return NextResponse.json({
    id: litigationId,
    status: inserted.status,
    openedAt: inserted.opened_at,
  })
}
