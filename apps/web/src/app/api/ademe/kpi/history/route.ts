/**
 * KOVAS — GET /api/ademe/kpi/history
 *
 * Renvoie les 12 derniers snapshots KPI (1 par jour) pour le LineChart
 * d'évolution mensuelle dans le cockpit ADEME.
 *
 * Query string : `?period=12m|30d|90d` (défaut 12m).
 */

import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'
import type { AdemeKpiSnapshotRow } from '../current/route'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PERIOD_TO_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '12m': 365,
}

export async function GET(request: Request) {
  const { orgId, supabase } = await getCurrentUser()

  const url = new URL(request.url)
  const periodKey = url.searchParams.get('period') ?? '12m'
  const days = PERIOD_TO_DAYS[periodKey] ?? 365

  const since = new Date()
  since.setUTCDate(since.getUTCDate() - days)
  const sinceDate = since.toISOString().slice(0, 10)

  const { data, error } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: types DB pas encore régénérés
    .from('ademe_kpi_snapshots' as any)
    .select('*')
    .eq('organization_id', orgId)
    .gte('snapshot_date', sinceDate)
    .order('snapshot_date', { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load snapshot history', detail: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({
    snapshots: (data ?? []) as unknown as AdemeKpiSnapshotRow[],
    period: periodKey,
  })
}
