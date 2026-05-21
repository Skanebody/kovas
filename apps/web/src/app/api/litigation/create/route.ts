/**
 * KOVAS — Ouverture d'un litige sur une mission.
 *
 * POST /api/litigation/create  { missionId, reason }
 *
 * 1. Insère la row `litigations` (status = 'opened')
 * 2. Déclenche en best-effort la génération IA (Edge Function `litigation-ai`)
 *    — fallback : réponse placeholder + jurisprudences vides.
 * 3. Renvoie le LitigationData complet.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import type { LitigationData } from '@/components/defense/LitigationWorkflow'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface CreateBody {
  missionId: string
  reason: string
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

  const { data: inserted, error: insErr } = await supabase
    .from('litigations' as never)
    .insert({
      organization_id: orgId,
      mission_id: body.missionId,
      status: 'opened',
      reason,
      opened_at: new Date().toISOString(),
      opened_by: userId,
    } as never)
    .select('id')
    .single()

  if (insErr || !inserted) {
    return NextResponse.json({ error: insErr?.message ?? 'insert_failed' }, { status: 500 })
  }

  const litigationId = (inserted as unknown as { id: string }).id

  await supabase.from('audit_log' as never).insert({
    organization_id: orgId,
    user_id: userId,
    action: 'litigation.create',
    resource_type: 'litigation',
    resource_id: litigationId,
  } as never)

  // Best-effort : déclenche l'Edge Function de génération IA (réponse + juris).
  // Si elle échoue ou n'existe pas encore (V1), on renvoie un placeholder.
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

  const response: LitigationData = {
    id: litigationId,
    status: 'opened',
    openedAt: new Date().toISOString(),
    reason,
    aiSuggestedResponse:
      'Réponse en cours de génération… utilisez "Régénérer" si elle reste vide après quelques secondes.',
    jurisprudences: [],
    lawyerLetterUrl: null,
  }
  return NextResponse.json(response)
}
