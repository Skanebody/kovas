/**
 * /admin/storage — Vue d'ensemble du stockage par organisation.
 *
 * Server component, charge la liste via service_role + lib/admin/storage-metrics.
 * Filtres URL : ?plan, ?pct (75/90/100), ?page.
 */

import { StorageOverview } from '@/components/admin/storage/StorageOverview'
import { AppPageHeader } from '@/components/app-page-header'
import { type StorageUsageFilter, getStorageOverview } from '@/lib/admin/storage-metrics'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Stockage · Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

const PAGE_LIMIT = 25

interface PageProps {
  searchParams: Promise<{
    plan?: string
    pct?: string
    page?: string
  }>
}

function parsePctFilter(v: string | undefined): { filter: StorageUsageFilter; min: number } {
  switch (v) {
    case 'over_75':
      return { filter: 'over_75', min: 75 }
    case 'over_90':
      return { filter: 'over_90', min: 90 }
    case 'over_100':
      return { filter: 'over_100', min: 100 }
    default:
      return { filter: 'all', min: 0 }
  }
}

export default async function AdminStoragePage({ searchParams }: PageProps) {
  const sp = await searchParams
  const supabase = createAdminClient()

  const planFilter = sp.plan ?? 'all'
  const { filter: pctFilter, min: minPct } = parsePctFilter(sp.pct)
  const page = Math.max(1, Number.parseInt(sp.page ?? '1', 10) || 1)

  const data = await getStorageOverview(supabase, {
    plan: planFilter === 'all' ? null : planFilter,
    minPct: minPct > 0 ? minPct : null,
  })

  return (
    <div className="space-y-7 max-w-7xl">
      <AppPageHeader
        eyebrow="💾 Stockage · pilotage quotas"
        title="Stockage"
        accent="par organisation"
        description="Top consommateurs, saturation, intervention quota +20 Go ponctuelle. Le tri est fixé sur l'usage descendant."
      />

      <StorageOverview
        data={data}
        filterPlan={planFilter}
        filterPct={pctFilter}
        page={page}
        limit={PAGE_LIMIT}
      />
    </div>
  )
}
