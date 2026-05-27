/**
 * KOVAS — Relay Next.js → Supabase Edge Function `parameter-suggest`.
 *
 * POST /api/parameters/suggest
 *
 * Body : { parameterName, context, missionId? }
 *
 * Rate limit : 120 suggestions / heure / user (saisie terrain peut être dense).
 *
 * Authority : CLAUDE.md §3 + §10.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import type { ParameterName, SuggestionContext } from '@/lib/parameters/parameter-types'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WINDOW_MS = 60 * 60 * 1000
const MAX_PER_WINDOW = 120
const HARD_MAX_ENTRIES = 5_000

const rateBucket = new Map<string, number[]>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const fresh = (rateBucket.get(userId) ?? []).filter((t) => now - t < WINDOW_MS)
  if (fresh.length >= MAX_PER_WINDOW) {
    rateBucket.set(userId, fresh)
    return true
  }
  fresh.push(now)
  rateBucket.set(userId, fresh)
  if (rateBucket.size > HARD_MAX_ENTRIES) {
    for (const [k, v] of rateBucket) {
      const stillFresh = v.filter((t) => now - t < WINDOW_MS)
      if (stillFresh.length === 0) rateBucket.delete(k)
      else rateBucket.set(k, stillFresh)
    }
  }
  return false
}

interface RequestBody {
  parameterName: ParameterName
  context: SuggestionContext
  missionId?: string
}

export async function POST(request: Request): Promise<Response> {
  let userId: string
  let orgId: string
  let accessToken: string | null = null
  try {
    const u = await getCurrentUser()
    userId = u.user.id
    orgId = u.orgId
    const { data } = await u.supabase.auth.getSession()
    accessToken = data.session?.access_token ?? null
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  if (!accessToken) {
    return NextResponse.json({ error: 'no_active_session' }, { status: 401 })
  }

  if (isRateLimited(userId)) {
    return NextResponse.json(
      { error: 'rate_limited', message: '120 suggestions / heure maximum.' },
      { status: 429 },
    )
  }

  let body: RequestBody
  try {
    body = (await request.json()) as RequestBody
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  if (!body.parameterName || typeof body.parameterName !== 'string') {
    return NextResponse.json({ error: 'parameterName_required' }, { status: 400 })
  }
  if (!body.context || typeof body.context !== 'object') {
    return NextResponse.json({ error: 'context_required' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    return NextResponse.json({ error: 'supabase_url_not_configured' }, { status: 500 })
  }
  const edgeUrl = `${supabaseUrl}/functions/v1/parameter-suggest`

  try {
    const edgeResp = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        parameterName: body.parameterName,
        context: body.context,
        organizationId: orgId,
        missionId: body.missionId ?? null,
        userId,
      }),
    })

    const payload = (await edgeResp.json().catch(() => null)) as unknown
    if (!edgeResp.ok) {
      return NextResponse.json(payload ?? { error: 'edge_error' }, { status: edgeResp.status })
    }
    return NextResponse.json(payload ?? {})
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ error: `edge_unreachable: ${msg}` }, { status: 502 })
  }
}
