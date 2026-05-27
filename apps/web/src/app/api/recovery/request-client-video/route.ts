/**
 * KOVAS — Route API POST /api/recovery/request-client-video
 *
 * Garde-fou local : envoie un SMS au client avec un lien visio + motif.
 *
 * Body :
 *   {
 *     missionId, organizationId,
 *     clientPhone: "+33...",
 *     meetingUrl:  "https://...",
 *     reason:      "≥ 10 chars"
 *   }
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { safeLog } from '@/lib/security/safe-logger'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 15

const bodySchema = z.object({
  missionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  clientPhone: z.string().regex(/^\+[1-9]\d{1,14}$/),
  meetingUrl: z.string().url(),
  reason: z.string().min(10).max(300),
})

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'validation_failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { missionId, organizationId, clientPhone, meetingUrl, reason } = parsed.data

  // Vérifie que la mission appartient bien à l'orga
  const { data: mission, error: missionErr } = await supabase
    .from('missions')
    .select('id')
    .eq('id', missionId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (missionErr || !mission) {
    return NextResponse.json({ error: 'mission_not_found' }, { status: 404 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }

  let edgeRes: Response
  try {
    edgeRes = await fetch(`${supabaseUrl}/functions/v1/request-client-video`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        missionId,
        organizationId,
        clientPhone,
        meetingUrl,
        reason,
      }),
    })
  } catch (err) {
    safeLog.error('[recovery/request-client-video] edge_unreachable', err)
    return NextResponse.json({ error: 'edge_unreachable' }, { status: 502 })
  }

  const edgeData = (await edgeRes.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    message?: string
    smsId?: string
  }
  if (!edgeRes.ok || !edgeData.ok) {
    return NextResponse.json(
      { error: edgeData.error ?? 'edge_error', message: edgeData.message ?? null },
      { status: edgeRes.status || 502 },
    )
  }

  return NextResponse.json({ ok: true, smsId: edgeData.smsId ?? null })
}
