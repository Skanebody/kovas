import { getCurrentUser } from '@/lib/auth/current-user'
import { detectClusteringOpportunity } from '@/lib/scheduling/clustering-suggester'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface ClusteringBody {
  newMission: {
    geoLat: number
    geoLng: number
    startAt: string
  }
  radiusKm?: number
}

/**
 * POST /api/scheduling/clustering-opportunity
 *
 * Body : { newMission, radiusKm? }
 * Return : ClusteringOpportunity | null
 */
export async function POST(request: Request) {
  let session: Awaited<ReturnType<typeof getCurrentUser>>
  try {
    session = await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as ClusteringBody | null
  if (!body?.newMission) {
    return NextResponse.json({ error: 'missing newMission' }, { status: 400 })
  }

  const { newMission } = body
  if (
    typeof newMission.geoLat !== 'number' ||
    typeof newMission.geoLng !== 'number' ||
    typeof newMission.startAt !== 'string'
  ) {
    return NextResponse.json({ error: 'invalid newMission payload' }, { status: 400 })
  }

  try {
    const opportunity = await detectClusteringOpportunity(
      {
        userId: session.user.id,
        newMission: {
          geoLat: newMission.geoLat,
          geoLng: newMission.geoLng,
          startAt: new Date(newMission.startAt),
        },
        radiusKm: body.radiusKm,
      },
      session.supabase,
    )
    return NextResponse.json(opportunity)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'clustering opportunity failed' },
      { status: 500 },
    )
  }
}
