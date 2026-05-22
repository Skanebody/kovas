/**
 * KOVAS — Route API POST /api/recovery/request-client-photo
 *
 * Garde-fou local : déclenche l'envoi d'un SMS à un client pour qu'il
 * upload une photo demandée par son diagnostiqueur (oubli terrain).
 *
 * Body :
 *   {
 *     missionId:        uuid,
 *     organizationId:   uuid,
 *     clientPhone:      "+33...",     // E.164
 *     photoDescription: "≥ 10 chars"
 *   }
 *
 * Auth : requise (membre de l'organisation).
 * Sécurité : on vérifie via RLS que le user appartient à `organizationId`.
 * Délègue : Edge Function `request-client-photo` (envoi SMS + persistance).
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'

import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 15

const bodySchema = z.object({
  missionId: z.string().uuid(),
  organizationId: z.string().uuid(),
  clientPhone: z.string().regex(/^\+[1-9]\d{1,14}$/),
  photoDescription: z.string().min(10).max(500),
})

interface EdgeResponse {
  ok?: boolean
  token?: string
  expiresAt?: string
  uploadUrl?: string
  error?: string
  message?: string
}

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
  const { missionId, organizationId, clientPhone, photoDescription } = parsed.data

  // Vérifie que la mission appartient bien à l'orga (RLS check)
  const { data: mission, error: missionErr } = await supabase
    .from('missions')
    .select('id, organization_id')
    .eq('id', missionId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (missionErr || !mission) {
    return NextResponse.json({ error: 'mission_not_found' }, { status: 404 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[recovery/request-client-photo] missing env vars')
    return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 })
  }

  let edgeRes: Response
  try {
    edgeRes = await fetch(`${supabaseUrl}/functions/v1/request-client-photo`, {
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
        photoDescription,
        requestedBy: user.id,
      }),
    })
  } catch (err) {
    console.error('[recovery/request-client-photo] edge_unreachable', err)
    return NextResponse.json({ error: 'edge_unreachable' }, { status: 502 })
  }

  const edgeData = (await edgeRes.json().catch(() => ({}))) as EdgeResponse

  if (!edgeRes.ok || !edgeData.ok || !edgeData.token) {
    return NextResponse.json(
      {
        error: edgeData.error ?? 'edge_error',
        message: edgeData.message ?? null,
      },
      { status: edgeRes.status || 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    token: edgeData.token,
    expiresAt: edgeData.expiresAt,
    uploadUrl: edgeData.uploadUrl,
  })
}
