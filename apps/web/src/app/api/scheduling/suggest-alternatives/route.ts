import { getCurrentUser } from '@/lib/auth/current-user'
import { generateAlternatives } from '@/lib/scheduling/alternative-generator'
import type { Conflict } from '@/lib/scheduling/conflict-detector'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface SuggestAlternativesBody {
  newMission: {
    geoLat: number
    geoLng: number
    startAt: string
    estimatedDurationMin: number
  }
  conflicts: Conflict[]
  maxDaysAhead?: number
}

/**
 * POST /api/scheduling/suggest-alternatives
 *
 * Body : { newMission, conflicts, maxDaysAhead? }
 * Return : Alternative[]
 */
export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof getCurrentUser>>
  try {
    session = await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as SuggestAlternativesBody | null

  if (!body?.newMission) {
    return NextResponse.json({ error: 'missing newMission' }, { status: 400 })
  }

  const { newMission } = body
  if (
    typeof newMission.geoLat !== 'number' ||
    typeof newMission.geoLng !== 'number' ||
    typeof newMission.estimatedDurationMin !== 'number' ||
    typeof newMission.startAt !== 'string'
  ) {
    return NextResponse.json({ error: 'invalid newMission payload' }, { status: 400 })
  }

  try {
    const alternatives = await generateAlternatives(
      {
        userId: session.user.id,
        newMission: {
          geoLat: newMission.geoLat,
          geoLng: newMission.geoLng,
          startAt: new Date(newMission.startAt),
          estimatedDurationMin: newMission.estimatedDurationMin,
        },
        conflicts: Array.isArray(body.conflicts) ? body.conflicts : [],
        maxDaysAhead: body.maxDaysAhead,
      },
      session.supabase,
    )
    return NextResponse.json(alternatives)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'suggest alternatives failed' },
      { status: 500 },
    )
  }
}
