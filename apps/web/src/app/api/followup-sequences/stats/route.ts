/**
 * KOVAS — Stats agrégées des séquences de relance (header du manager).
 *
 * GET /api/followup-sequences/stats  → { activeCount, averageResponseRate }
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface AggRow {
  status: string | null
  response_received_at: string | null
}

export async function GET(): Promise<Response> {
  try {
    const { orgId, supabase } = await getCurrentUser()
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('follow_up_sequences' as never)
      .select('status, response_received_at')
      .eq('organization_id', orgId)
      .gte('started_at', since)
      .limit(5000)
    if (error) {
      const msg = error.message ?? ''
      if (
        msg.includes('does not exist') ||
        msg.includes('schema cache') ||
        error.code === '42P01'
      ) {
        return NextResponse.json({ activeCount: 0, averageResponseRate: 0 })
      }
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const rows = (data ?? []) as unknown as AggRow[]
    const activeCount = rows.filter((r) => r.status === 'active').length
    const totalCompletedOrCancelled = rows.filter(
      (r) => r.status === 'completed' || r.status === 'cancelled',
    ).length
    const responses = rows.filter((r) => r.response_received_at !== null).length
    const averageResponseRate =
      totalCompletedOrCancelled === 0 ? 0 : responses / totalCompletedOrCancelled

    return NextResponse.json({ activeCount, averageResponseRate })
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
}
