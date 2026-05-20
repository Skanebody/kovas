import { getCurrentUser } from '@/lib/auth/current-user'
import { type ConflictDetectionInput, detectConflict } from '@/lib/scheduling/conflict-detector'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * POST /api/scheduling/detect-conflict
 *
 * Body : Omit<ConflictDetectionInput, 'userId'>
 *   { newMission: { geoLat, geoLng, startAt, estimatedDurationMin, excludeDossierId? }, bufferMinutes? }
 *
 * Return : ConflictResult
 */
export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof getCurrentUser>>
  try {
    session = await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as
    | (Omit<ConflictDetectionInput, 'userId'> & {
        newMission: {
          geoLat: number
          geoLng: number
          startAt: string
          estimatedDurationMin: number
          excludeDossierId?: string
        }
      })
    | null

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
    const result = await detectConflict(
      {
        userId: session.user.id,
        newMission: {
          geoLat: newMission.geoLat,
          geoLng: newMission.geoLng,
          startAt: new Date(newMission.startAt),
          estimatedDurationMin: newMission.estimatedDurationMin,
          excludeDossierId: newMission.excludeDossierId,
        },
        bufferMinutes: body.bufferMinutes,
      },
      session.supabase,
    )
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'detect conflict failed' },
      { status: 500 },
    )
  }
}
