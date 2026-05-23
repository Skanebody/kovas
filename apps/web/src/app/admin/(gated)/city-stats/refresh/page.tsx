/**
 * /admin/city-stats/refresh — Pipeline data RÉELLES par ville.
 *
 * Affiche :
 *   - KPIs : Total villes, fresh / stale / pending / failed
 *   - Tableau filtrable : ville / status / sources / dernier refresh / next due
 *   - Boutons : forcer refresh ville unitaire + lancer batch global
 *   - Historique des dernières runs
 */

import { createAdminClient } from '@/lib/admin/supabase-admin'
import type { Metadata } from 'next'
import { CityStatsRefreshBoard } from './CityStatsRefreshBoard'

export const metadata: Metadata = {
  title: 'City Stats — Refresh queue',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface CityStatsRow {
  readonly citySlug: string
  readonly cityName: string
  readonly deptCode: string
  readonly inseeCode: string | null
  readonly refreshStatus: 'pending' | 'fetching' | 'success' | 'partial' | 'failed'
  readonly healthStatus: 'fresh' | 'stale' | 'failed' | 'pending' | 'fetching' | 'unknown'
  readonly totalDpeCount: number
  readonly sourcesCount: number
  readonly lastRefreshedAt: string | null
  readonly nextRefreshDue: string | null
  readonly lastError: string | null
}

export interface CityStatsSummary {
  readonly total: number
  readonly fresh: number
  readonly stale: number
  readonly pending: number
  readonly failed: number
  readonly fetching: number
}

interface RawQueueRow {
  city_slug: string
  city_name: string
  dept_code: string
  insee_code: string | null
  refresh_status: string
  health_status: string
  total_dpe_count: number
  sources_count: number
  last_refreshed_at: string | null
  next_refresh_due: string | null
  last_error: string | null
}

async function loadQueue(): Promise<{
  rows: CityStatsRow[]
  summary: CityStatsSummary
}> {
  const supabase = createAdminClient()
  // biome-ignore lint/suspicious/noExplicitAny: vue pas dans Database types
  const { data, error } = await (supabase as any)
    .from('admin_city_stats_queue')
    .select(
      'city_slug, city_name, dept_code, insee_code, refresh_status, health_status, ' +
        'total_dpe_count, sources_count, last_refreshed_at, next_refresh_due, last_error',
    )
    .order('next_refresh_due', { ascending: true, nullsFirst: true })
    .limit(500)

  if (error) {
    console.error('[admin/city-stats/refresh] loadQueue:', error.message)
    return {
      rows: [],
      summary: { total: 0, fresh: 0, stale: 0, pending: 0, failed: 0, fetching: 0 },
    }
  }

  const rows: CityStatsRow[] = ((data ?? []) as RawQueueRow[]).map((r) => ({
    citySlug: r.city_slug,
    cityName: r.city_name,
    deptCode: r.dept_code,
    inseeCode: r.insee_code,
    refreshStatus: (r.refresh_status as CityStatsRow['refreshStatus']) ?? 'pending',
    healthStatus: (r.health_status as CityStatsRow['healthStatus']) ?? 'unknown',
    totalDpeCount: r.total_dpe_count,
    sourcesCount: r.sources_count,
    lastRefreshedAt: r.last_refreshed_at,
    nextRefreshDue: r.next_refresh_due,
    lastError: r.last_error,
  }))

  const summary: CityStatsSummary = {
    total: rows.length,
    fresh: rows.filter((r) => r.healthStatus === 'fresh').length,
    stale: rows.filter((r) => r.healthStatus === 'stale').length,
    pending: rows.filter((r) => r.healthStatus === 'pending').length,
    failed: rows.filter((r) => r.healthStatus === 'failed').length,
    fetching: rows.filter((r) => r.healthStatus === 'fetching').length,
  }

  return { rows, summary }
}

export default async function CityStatsRefreshPage() {
  const { rows, summary } = await loadQueue()
  return <CityStatsRefreshBoard rows={rows} summary={summary} />
}
