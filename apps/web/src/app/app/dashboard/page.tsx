import { DocumentScanButton } from '@/components/documents'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { Metadata } from 'next'
import { AlertsAndActions } from './alerts-and-actions'
import { CockpitHero } from './cockpit-hero'
import { DashboardPipeline } from './dashboard-pipeline'
import { DiagnosticsBreakdown } from './diagnostics-breakdown'
import { RecentActivityBlock } from './recent-activity-block'
import { StatsDonutGrid } from './stats-donut-grid'
import { TodayBlock } from './today-block'

export const metadata: Metadata = { title: 'Tableau de bord' }

export default async function DashboardPage() {
  const { profile } = await getCurrentUser()
  const firstName = profile.full_name?.split(' ')[0] ?? 'à vous'

  return (
    <div className="space-y-8">
      <CockpitHero firstName={firstName} />

      <div className="flex flex-wrap items-center justify-end gap-3">
        <DocumentScanButton placement="dashboard" variant="primary" />
      </div>

      <div className="space-y-8 animate-fade-in">
        <TodayBlock />
        <DashboardPipeline />
        <StatsDonutGrid />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AlertsAndActions />
          <RecentActivityBlock />
          <DiagnosticsBreakdown />
        </div>
      </div>
    </div>
  )
}
