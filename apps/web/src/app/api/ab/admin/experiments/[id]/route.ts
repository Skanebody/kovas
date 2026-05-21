import { getAbAdminClient } from '@/lib/ab-testing/admin-client'
import type { AbExperimentStatusDB } from '@/lib/ab-testing/types'
import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

/**
 * PATCH /api/ab/admin/experiments/[id]
 *
 * Body : { action: 'start' | 'pause' | 'conclude' | 'abort', winnerVariant?: string }
 *
 * - start    : draft|paused → running, started_at = now()
 * - pause    : running → paused
 * - conclude : running|paused → completed, ended_at = now(), winner_variant = body.winnerVariant
 * - abort    : * → aborted, ended_at = now()
 */
export const runtime = 'nodejs'

interface PatchBody {
  action?: unknown
  winnerVariant?: unknown
}

const TRANSITIONS: Record<'start' | 'pause' | 'conclude' | 'abort', AbExperimentStatusDB> = {
  start: 'running',
  pause: 'paused',
  conclude: 'completed',
  abort: 'aborted',
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await getCurrentUser()
  const { id } = await params

  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }

  const action = typeof body.action === 'string' ? body.action : ''
  if (!(action in TRANSITIONS)) {
    return NextResponse.json(
      { error: 'action must be start|pause|conclude|abort' },
      { status: 400 },
    )
  }
  const newStatus = TRANSITIONS[action as keyof typeof TRANSITIONS]

  const supabase = getAbAdminClient()

  const update: {
    status: AbExperimentStatusDB
    started_at?: string
    ended_at?: string | null
    winner_variant?: string | null
  } = { status: newStatus }

  if (action === 'start') {
    update.started_at = new Date().toISOString()
    update.ended_at = null
    update.winner_variant = null
  } else if (action === 'conclude') {
    update.ended_at = new Date().toISOString()
    if (typeof body.winnerVariant === 'string' && body.winnerVariant.trim()) {
      update.winner_variant = body.winnerVariant.trim()
    }
  } else if (action === 'abort') {
    update.ended_at = new Date().toISOString()
  }

  const { error } = await supabase.from('ab_experiments').update(update).eq('id', id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true, status: newStatus })
}
