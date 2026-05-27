import { ClusteringAdoptionStats } from '@/components/admin/scheduling/ClusteringAdoptionStats'
import { ConflictDetectionStats } from '@/components/admin/scheduling/ConflictDetectionStats'
import { DpeQuotaPerUserChart } from '@/components/admin/scheduling/DpeQuotaPerUserChart'
import { DurationAccuracyChart } from '@/components/admin/scheduling/DurationAccuracyChart'
import { UserSpeedTable } from '@/components/admin/scheduling/UserSpeedTable'
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { AppPageHeader } from '@/components/app-page-header'
import { getSchedulingMetricsSnapshot } from '@/lib/admin/scheduling-metrics'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { AlertTriangle, Gauge, MapPin, ShieldAlert } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Pilotage scheduling · Admin',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function formatDiff(min: number): string {
  if (min === 0) return '0 min'
  const sign = min > 0 ? '+' : ''
  return `${sign}${min.toFixed(1)} min`
}

export default async function AdminSchedulingPage() {
  const supabase = createAdminClient()
  const snapshot = await getSchedulingMetricsSnapshot(supabase)
  const { durationAccuracy, conflicts, dpeQuotaTop, clustering, userSpeed } = snapshot

  const usersAboveThreshold = dpeQuotaTop.filter((u) => u.severity !== 'ok').length
  const conflictResolutionRate =
    conflicts.detected > 0 ? Math.round((conflicts.resolved / conflicts.detected) * 1000) / 10 : 0

  return (
    <div className="space-y-7 max-w-7xl">
      <AppPageHeader
        eyebrow="📅 Scheduling · 30 derniers jours"
        title="Pilotage"
        accent="scheduling"
        description="Précision estimations, conflits détectés, quota DPE 12 mois glissants et adoption clustering."
      />

      {/* Grid 4 KPI cards */}
      <section
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="KPI scheduling"
      >
        <AdminMetricCard
          eyebrow="Précision estimations"
          value={formatDiff(durationAccuracy.avgDiffMin30d)}
          hint={`${durationAccuracy.sampleSize} missions analysées`}
          icon={Gauge}
        />
        <AdminMetricCard
          eyebrow="Conflits détectés"
          value={String(conflicts.detected)}
          hint={`${conflicts.resolved} résolus · ${conflictResolutionRate}%`}
          icon={AlertTriangle}
        />
        <AdminMetricCard
          eyebrow="Users quota DPE"
          value={String(usersAboveThreshold)}
          hint="≥ 80% de la limite légale (1000/an)"
          icon={ShieldAlert}
        />
        <AdminMetricCard
          eyebrow="Trajets économisés"
          value={`${clustering.savingsMin} min`}
          hint={`${clustering.accepted} missions regroupées`}
          icon={MapPin}
        />
      </section>

      {/* Charts ligne 1 : Duration accuracy + DPE quota */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-2" aria-label="Précision et quota">
        <DurationAccuracyChart series={durationAccuracy.series} />
        <DpeQuotaPerUserChart users={dpeQuotaTop} />
      </section>

      {/* Charts ligne 2 : Conflicts + clustering adoption */}
      <section
        className="grid gap-4 grid-cols-1 lg:grid-cols-2"
        aria-label="Conflits et clustering"
      >
        <ConflictDetectionStats conflicts={conflicts} />
        <ClusteringAdoptionStats clustering={clustering} />
      </section>

      {/* User speed table */}
      <section aria-label="Coefficients personnels users">
        <UserSpeedTable rows={userSpeed} />
      </section>
    </div>
  )
}
