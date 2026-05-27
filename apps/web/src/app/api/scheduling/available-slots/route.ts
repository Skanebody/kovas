import { getCurrentUser } from '@/lib/auth/current-user'
import { findAvailableSlots } from '@/lib/scheduling/slot-finder'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * GET /api/scheduling/available-slots?date=YYYY-MM-DD&duration=90
 *
 * Return : AvailableSlot[]
 */
export async function GET(request: Request) {
  let session: Awaited<ReturnType<typeof getCurrentUser>>
  try {
    session = await getCurrentUser()
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const dateParam = searchParams.get('date')
  const durationParam = searchParams.get('duration')

  if (!dateParam || !durationParam) {
    return NextResponse.json({ error: 'missing date or duration' }, { status: 400 })
  }

  // Validate date format YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json(
      { error: 'invalid date format (expected YYYY-MM-DD)' },
      { status: 400 },
    )
  }

  const duration = Number.parseInt(durationParam, 10)
  if (!Number.isFinite(duration) || duration <= 0) {
    return NextResponse.json({ error: 'invalid duration' }, { status: 400 })
  }

  // Interprète dateParam comme midi UTC pour éviter les bascules timezone côté Europe/Paris
  const date = new Date(`${dateParam}T12:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: 'invalid date' }, { status: 400 })
  }

  try {
    const slots = await findAvailableSlots(session.user.id, date, duration, session.supabase)
    return NextResponse.json(slots)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'available slots failed'
    // Graceful degradation : si colonnes scheduling pas créées (migration pas appliquée),
    // retourner liste vide. L'UI affichera "Aucun créneau dispo" propre au lieu de 500.
    if (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('column')) {
      console.warn('[available-slots] schema mismatch, returning empty list:', msg)
      return NextResponse.json([])
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
