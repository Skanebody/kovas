/**
 * POST /api/dashboard/insights/track — tracking interactions sur Insights IA (Section 5).
 *
 * Body : { insight_id: string, action: 'cta_primary' | 'cta_secondary' | 'dismiss' | 'viewed' }
 *
 * V1 (stub) : auth check + log structuré console + ack 200. La persistence DB sera
 * ajoutée en V1.5 via la table `insight_interactions` (org_id, user_id, insight_id,
 * action, created_at) alimentant les métriques de taux de clic insights.
 *
 * Auth requise : Supabase cookie. Le client envoie via `fetch(... keepalive: true)`,
 * donc les erreurs ne doivent pas casser la navigation utilisateur (silent fail
 * côté client déjà géré).
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const ALLOWED_ACTIONS = ['cta_primary', 'cta_secondary', 'dismiss', 'viewed'] as const
type TrackAction = (typeof ALLOWED_ACTIONS)[number]

interface TrackBody {
  insight_id?: unknown
  action?: unknown
}

function isAllowedAction(value: unknown): value is TrackAction {
  return typeof value === 'string' && (ALLOWED_ACTIONS as readonly string[]).includes(value)
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  let body: TrackBody
  try {
    body = (await request.json()) as TrackBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const insightId = typeof body.insight_id === 'string' ? body.insight_id : ''
  if (!insightId || insightId.length > 128) {
    return NextResponse.json({ error: 'insight_id requis (max 128 chars)' }, { status: 400 })
  }

  if (!isAllowedAction(body.action)) {
    return NextResponse.json(
      { error: `action doit être ${ALLOWED_ACTIONS.join(' | ')}` },
      { status: 400 },
    )
  }

  // V1 : log structuré (PostHog / Sentry pourront le récupérer plus tard).
  // V1.5 : INSERT dans `insight_interactions`.
  // biome-ignore lint/suspicious/noConsole: stub V1 — sera remplacé par INSERT DB en V1.5.
  console.info('[insights.track]', {
    user_id: user.id,
    insight_id: insightId,
    action: body.action,
    timestamp: new Date().toISOString(),
  })

  return NextResponse.json({ ok: true })
}
