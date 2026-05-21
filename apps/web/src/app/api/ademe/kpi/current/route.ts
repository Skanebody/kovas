/**
 * KOVAS — GET /api/ademe/kpi/current
 *
 * Renvoie le dernier snapshot KPI ADEME de l'organisation (cockpit ADEME).
 *
 * Les colonnes `ademe_kpi_snapshots.*` ne sont pas encore générées dans
 * `@kovas/database/types`. Cast local typé jusqu'à `pnpm db:gen-types`.
 */

import { NextResponse } from 'next/server'

import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface AdemeKpiSnapshotRow {
  id: string
  organization_id: string
  snapshot_date: string
  count_a: number
  count_b: number
  count_c: number
  count_d: number
  count_e: number
  count_f: number
  count_g: number
  ges_count_a: number
  ges_count_b: number
  ges_count_c: number
  ges_count_d: number
  ges_count_e: number
  ges_count_f: number
  ges_count_g: number
  total_dpe: number
  total_published: number
  total_anomalies: number
  error_rate: number
  avg_surface_m2: number | null
  avg_energy_value: number | null
  avg_ges_value: number | null
  metadata: {
    dpe_count_12m?: number
    dpe_count_30d?: number
    dpe_count_7d?: number
    dpe_count_today?: number
    ratio_fg?: number
    ratio_de?: number
    ratio_a_to_c?: number
    avg_distance_km?: number | null
    max_distance_km?: number | null
    risk_score_0_100?: number
    risk_level?: 'green' | 'yellow' | 'red'
  } | null
  created_at: string
}

export async function GET() {
  const { orgId, supabase } = await getCurrentUser()

  const { data, error } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: types DB pas encore régénérés
    .from('ademe_kpi_snapshots' as any)
    .select('*')
    .eq('organization_id', orgId)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load latest snapshot', detail: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json({
    snapshot: (data as unknown as AdemeKpiSnapshotRow | null) ?? null,
  })
}
