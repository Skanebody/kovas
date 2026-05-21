/**
 * KOVAS — Relay Next.js → Supabase Edge Function `regulatory-ai-chat`.
 *
 * Pourquoi un relay ?
 *   - Centralise auth (cookies Supabase Next.js) + rate limiting par user_id
 *   - Permet d'ajouter quotas, abuse detection, logging applicatif
 *   - Le client front parle uniquement à des routes Next (CORS-friendly)
 *
 * Rate limit : 30 messages / heure / user (anti-abus + protection coûts API).
 *
 * Stream SSE : on forwarde directement le body de l'Edge Function vers le client.
 *
 * Authority : CLAUDE.md §16 support IA-first + §10 rate limiting.
 */

import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WINDOW_MS = 60 * 60 * 1000 // 1h
const MAX_MESSAGES_PER_WINDOW = 30
const HARD_MAX_ENTRIES = 5_000

const rateBucket = new Map<string, number[]>()

function isRateLimited(userId: string): boolean {
  const now = Date.now()
  const existing = rateBucket.get(userId) ?? []
  const fresh = existing.filter((t) => now - t < WINDOW_MS)
  if (fresh.length >= MAX_MESSAGES_PER_WINDOW) {
    rateBucket.set(userId, fresh)
    return true
  }
  fresh.push(now)
  rateBucket.set(userId, fresh)
  // Garde-fou anti-leak mémoire
  if (rateBucket.size > HARD_MAX_ENTRIES) {
    for (const [k, v] of rateBucket) {
      const stillFresh = v.filter((t) => now - t < WINDOW_MS)
      if (stillFresh.length === 0) rateBucket.delete(k)
      else rateBucket.set(k, stillFresh)
    }
  }
  return false
}

interface ChatRequestBody {
  sessionId?: string
  message?: string
  missionContext?: {
    dossierId?: string
    currentField?: string
  }
}

export async function POST(request: Request): Promise<Response> {
  let userId: string
  let accessToken: string | null = null
  try {
    const u = await getCurrentUser()
    userId = u.user.id
    // Récupère le JWT pour forward vers l'Edge Function (auth user).
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
      { error: 'rate_limited', message: '30 messages / heure maximum.' },
      { status: 429 },
    )
  }

  let body: ChatRequestBody
  try {
    body = (await request.json()) as ChatRequestBody
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  if (typeof body.message !== 'string' || body.message.trim().length === 0) {
    return NextResponse.json({ error: 'message_required' }, { status: 400 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    return NextResponse.json({ error: 'supabase_url_not_configured' }, { status: 500 })
  }

  const edgeUrl = `${supabaseUrl}/functions/v1/regulatory-ai-chat`

  let edgeResp: Response
  try {
    edgeResp = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ error: `edge_unreachable: ${msg}` }, { status: 502 })
  }

  if (!edgeResp.ok) {
    let errBody: unknown
    try {
      errBody = await edgeResp.json()
    } catch {
      errBody = { error: 'edge_function_error', status: edgeResp.status }
    }
    return NextResponse.json(errBody, { status: edgeResp.status })
  }

  // Forward le stream SSE tel quel.
  if (!edgeResp.body) {
    return NextResponse.json({ error: 'empty_stream' }, { status: 502 })
  }

  return new Response(edgeResp.body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      connection: 'keep-alive',
    },
  })
}
