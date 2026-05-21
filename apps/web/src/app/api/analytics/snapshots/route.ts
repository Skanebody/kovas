/**
 * /api/analytics/snapshots — snapshots analytics de l'organisation.
 *
 *  - GET ?periodType=month|quarter|year&limit=N
 *    Renvoie les N derniers snapshots de l'org pour le period_type donné.
 *
 *  - Tier gating : refusé si subscription tier non éligible (Standard+).
 */

import {
  type AnalyticsPeriodType,
  type BusinessAnalyticsSnapshotRow,
  isAnalyticsEnabled,
} from '@/lib/analytics/types'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const ALLOWED_PERIODS: AnalyticsPeriodType[] = ['day', 'week', 'month', 'quarter', 'year']

interface SnapshotsTable {
  select: (cols: string) => {
    eq: (col: string, val: string) => SnapshotsQueryChain
  }
}

type SnapshotsQueryChain = {
  eq: (col: string, val: string) => SnapshotsQueryChain
  order: (col: string, opts: { ascending: boolean }) => SnapshotsQueryChain
  limit: (
    n: number,
  ) => Promise<{ data: BusinessAnalyticsSnapshotRow[] | null; error: { message: string } | null }>
}

function snapshotsTable(supabase: SupabaseClient): SnapshotsTable {
  return (supabase as unknown as { from(t: 'business_analytics_snapshots'): SnapshotsTable }).from(
    'business_analytics_snapshots',
  )
}

interface SubscriptionsTable {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => {
      maybeSingle: () => Promise<{
        data: { tier: string | null; status: string } | null
        error: { message: string } | null
      }>
    }
  }
}

function subscriptionsTable(supabase: SupabaseClient): SubscriptionsTable {
  return (supabase as unknown as { from(t: 'subscriptions'): SubscriptionsTable }).from(
    'subscriptions',
  )
}

interface SnapshotsResponse {
  snapshots: BusinessAnalyticsSnapshotRow[]
  tierEnabled: boolean
}

export async function GET(
  request: Request,
): Promise<NextResponse<SnapshotsResponse | { error: string }>> {
  const { supabase, orgId } = await getCurrentUser()
  const url = new URL(request.url)
  const periodType = (url.searchParams.get('periodType') ?? 'month') as AnalyticsPeriodType
  if (!ALLOWED_PERIODS.includes(periodType)) {
    return NextResponse.json({ error: 'periodType invalide' }, { status: 400 })
  }
  const limit = Math.min(
    36,
    Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '12', 10) || 12),
  )

  const sub = await subscriptionsTable(supabase)
    .select('tier, status')
    .eq('organization_id', orgId)
    .maybeSingle()
  const tierEnabled = sub.data?.status === 'active' && isAnalyticsEnabled(sub.data?.tier)
  if (!tierEnabled) {
    return NextResponse.json({
      snapshots: [],
      tierEnabled: false,
    })
  }

  const { data, error } = await snapshotsTable(supabase)
    .select(
      'id, organization_id, snapshot_period, period_type, missions_total, missions_completed, missions_exported, missions_cancelled, diagnostic_mix, revenue_ht_cents, revenue_ttc_cents, avg_mission_value_cents, ai_cost_cents, variable_cost_cents, gross_margin_cents, gross_margin_ratio, avg_time_to_export_seconds, avg_voice_seconds_per_mission, avg_photos_per_mission, by_day_of_week, by_hour_of_day, unique_clients, recurring_clients, top_client_share_pct, top_departments, estimated_time_saved_seconds, created_at, updated_at',
    )
    .eq('organization_id', orgId)
    .eq('period_type', periodType)
    .order('snapshot_period', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(
    { snapshots: data ?? [], tierEnabled: true },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
