/**
 * POST /api/geocoding/address
 *
 * Body : { address: string }
 * Return : GeocodedAddress | { error }
 *
 * Wrapper authenticated autour de `lib/scheduling/geocoder.ts` (cache permanent).
 */

import { geocode } from '@/lib/scheduling/geocoder'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface GeocodingRequestBody {
  address?: unknown
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: GeocodingRequestBody
  try {
    body = (await request.json()) as GeocodingRequestBody
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  if (typeof body.address !== 'string' || body.address.trim().length < 3) {
    return NextResponse.json(
      { error: 'address must be a string of at least 3 characters' },
      { status: 400 },
    )
  }

  try {
    const result = await geocode(body.address, supabase)
    if (!result) {
      return NextResponse.json({ error: 'no result found for given address' }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
