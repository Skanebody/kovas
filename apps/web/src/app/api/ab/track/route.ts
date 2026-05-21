import { getAbAdminClient } from '@/lib/ab-testing/admin-client'
import {
  type ABEventType,
  type AbSupabase,
  loadExperiment,
  readAssignment,
  trackEvent,
} from '@/lib/ab-testing/assign'
import { NextResponse } from 'next/server'

/**
 * POST /api/ab/track
 *
 * Body : {
 *   experimentKey: string,
 *   userIdentifier: string,
 *   eventType: 'conversion' | 'click' | 'submit',
 *   eventValue?: number,
 *   eventData?: Record<string, unknown>
 * }
 *
 * Lit l'assignment existant et insère un event. Si aucun assignment
 * (= jamais exposé), on ignore silencieusement (l'event serait orphelin
 * de toute façon).
 */
export const runtime = 'nodejs'

const ALLOWED_EVENT_TYPES: ABEventType[] = ['conversion', 'click', 'submit']

interface TrackBody {
  experimentKey?: unknown
  userIdentifier?: unknown
  eventType?: unknown
  eventValue?: unknown
  eventData?: unknown
}

export async function POST(request: Request) {
  let body: TrackBody
  try {
    body = (await request.json()) as TrackBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const experimentKey = typeof body.experimentKey === 'string' ? body.experimentKey.trim() : ''
  const userIdentifier = typeof body.userIdentifier === 'string' ? body.userIdentifier.trim() : ''
  const eventTypeRaw = typeof body.eventType === 'string' ? body.eventType.trim() : ''
  const eventValue = typeof body.eventValue === 'number' ? body.eventValue : undefined
  const eventData =
    body.eventData && typeof body.eventData === 'object' && !Array.isArray(body.eventData)
      ? (body.eventData as Record<string, unknown>)
      : undefined

  if (!experimentKey || !userIdentifier || !eventTypeRaw) {
    return NextResponse.json(
      { error: 'experimentKey, userIdentifier and eventType are required' },
      { status: 400 },
    )
  }
  if (!ALLOWED_EVENT_TYPES.includes(eventTypeRaw as ABEventType)) {
    return NextResponse.json(
      { error: `eventType must be one of ${ALLOWED_EVENT_TYPES.join(', ')}` },
      { status: 400 },
    )
  }
  const eventType = eventTypeRaw as ABEventType

  let supabase: AbSupabase
  try {
    supabase = getAbAdminClient()
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'service role not configured' },
      { status: 503 },
    )
  }

  const exp = await loadExperiment(supabase, experimentKey)
  if (!exp) {
    // Experiment supprimée ou inconnue ⇒ event ignoré silencieusement.
    return NextResponse.json({ ok: true, ignored: 'unknown_experiment' })
  }

  const variant = await readAssignment(supabase, exp.id, userIdentifier)
  if (!variant) {
    // Jamais exposé : event orphelin, ignoré.
    return NextResponse.json({ ok: true, ignored: 'no_assignment' })
  }

  await trackEvent(supabase, {
    experimentId: exp.id,
    userIdentifier,
    eventType,
    variantAssigned: variant,
    eventValue,
    eventData,
  })

  return NextResponse.json({ ok: true })
}
