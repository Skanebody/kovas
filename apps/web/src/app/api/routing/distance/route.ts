/**
 * POST /api/routing/distance
 *
 * Body : { from: { lat: number, lng: number }, to: { lat: number, lng: number } }
 * Return : RouteInfo (ORS si clé d'env, sinon Haversine × 1.3 / 50km/h)
 */

import { type Coords, calculateRoute } from '@/lib/scheduling/route-calculator'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface DistanceRequestBody {
  from?: unknown
  to?: unknown
}

function isCoords(v: unknown): v is Coords {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { lat?: unknown }).lat === 'number' &&
    typeof (v as { lng?: unknown }).lng === 'number' &&
    Number.isFinite((v as Coords).lat) &&
    Number.isFinite((v as Coords).lng)
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: DistanceRequestBody
  try {
    body = (await request.json()) as DistanceRequestBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  if (!isCoords(body.from) || !isCoords(body.to)) {
    return NextResponse.json(
      { error: 'from and to must be { lat: number, lng: number }' },
      { status: 400 },
    )
  }

  try {
    const route = await calculateRoute(body.from, body.to, supabase)
    return NextResponse.json(route)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
