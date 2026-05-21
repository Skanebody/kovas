/**
 * /api/analytics/benchmarks — benchmarks anonymisés inter-cabinets.
 *
 * Le scope (national/region/department) est déterminé côté serveur à partir
 * des paramètres de l'organisation. Tant que cette logique n'est pas branchée,
 * on retombe sur 'national' + segment 'all'.
 *
 * Anti-déduction k-anonymity : on filtre côté serveur tous les rows
 * `cabinets_count < 5`.
 */

import { type AnonymousBenchmarkRow, BENCHMARK_MIN_SAMPLE_SIZE } from '@/lib/analytics/types'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

interface BenchmarksTable {
  select: (cols: string) => {
    eq: (col: string, val: string) => BenchmarksQueryChain
    gte: (col: string, val: number) => BenchmarksQueryChain
  }
}

type BenchmarksQueryChain = {
  eq: (col: string, val: string) => BenchmarksQueryChain
  gte: (col: string, val: number) => BenchmarksQueryChain
  order: (col: string, opts: { ascending: boolean }) => BenchmarksQueryChain
  limit: (
    n: number,
  ) => Promise<{ data: AnonymousBenchmarkRow[] | null; error: { message: string } | null }>
}

function benchmarksTable(supabase: SupabaseClient): BenchmarksTable {
  return (supabase as unknown as { from(t: 'anonymous_benchmarks'): BenchmarksTable }).from(
    'anonymous_benchmarks',
  )
}

interface BenchmarksResponse {
  benchmarks: AnonymousBenchmarkRow[]
  scope: 'national' | 'region' | 'department'
  scopeLabel: string
}

const ALLOWED_PERIODS = ['month', 'quarter', 'year'] as const
type AllowedPeriod = (typeof ALLOWED_PERIODS)[number]

export async function GET(
  request: Request,
): Promise<NextResponse<BenchmarksResponse | { error: string }>> {
  const { supabase } = await getCurrentUser()
  const url = new URL(request.url)

  const periodType = (url.searchParams.get('periodType') ?? 'month') as AllowedPeriod
  if (!ALLOWED_PERIODS.includes(periodType)) {
    return NextResponse.json({ error: 'periodType invalide' }, { status: 400 })
  }
  const limit = Math.min(
    24,
    Math.max(1, Number.parseInt(url.searchParams.get('limit') ?? '12', 10) || 12),
  )

  // V1 : on reste sur 'national' / 'all' / pas de diagnostic_kind.
  // La logique scope régionale arrivera quand `organizations.region_code` sera
  // déterministe (M3 / activation auto-quotes).
  const { data, error } = await benchmarksTable(supabase)
    .select(
      'id, snapshot_period, period_type, scope, scope_code, cabinet_segment, diagnostic_kind, cabinets_count, missions_count, k_anonymity_threshold, median_missions_per_cabinet, p25_missions_per_cabinet, p75_missions_per_cabinet, median_time_to_export_seconds, p25_time_to_export_seconds, p75_time_to_export_seconds, diagnostic_mix_pct, median_mission_value_cents, p25_mission_value_cents, p75_mission_value_cents, median_gross_margin_ratio, median_time_saved_seconds_per_mission, created_at, updated_at',
    )
    .eq('period_type', periodType)
    .eq('scope', 'national')
    .eq('cabinet_segment', 'all')
    .gte('cabinets_count', BENCHMARK_MIN_SAMPLE_SIZE)
    .order('snapshot_period', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(
    {
      benchmarks: data ?? [],
      scope: 'national',
      scopeLabel: 'National',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
