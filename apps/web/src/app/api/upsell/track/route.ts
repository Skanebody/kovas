/**
 * KOVAS — API route POST /api/upsell/track
 *
 * Endpoint client-side pour logger un event comportemental quand on n'est pas
 * dans un Server Component (ex: clic depuis un client component sur un
 * bouton gated). Le user_id vient de la session Supabase.
 */

import { createClient } from '@/lib/supabase/server'
import { type BehaviorEventType, trackBehaviorEvent } from '@/lib/upsell/track-event'
import { NextResponse } from 'next/server'

const VALID_EVENT_TYPES = new Set<BehaviorEventType>([
  'mission_created',
  'mission_exported',
  'invoice_created',
  'invoice_emitted',
  'invoice_paid',
  'devis_created',
  'devis_sent',
  'lead_received',
  'lead_responded',
  'lead_ignored',
  'pennylane_attempted',
  'analytics_attempted',
  'cockpit_m2_attempted',
  'bilingual_report_attempted',
  'signature_attempted',
  'whisper_quota_80pct',
  'storage_quota_80pct',
  'missions_quota_80pct',
  'vision_quota_80pct',
])

interface TrackRequestBody {
  event_type?: string
  event_data?: Record<string, unknown>
  organization_id?: string
}

export async function POST(request: Request) {
  let body: TrackRequestBody
  try {
    body = (await request.json()) as TrackRequestBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventType = body.event_type
  if (!eventType || !VALID_EVENT_TYPES.has(eventType as BehaviorEventType)) {
    return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await trackBehaviorEvent(supabase, user.id, eventType as BehaviorEventType, {
    organizationId: body.organization_id ?? null,
    eventData: body.event_data,
  })

  return NextResponse.json({ success: true })
}
