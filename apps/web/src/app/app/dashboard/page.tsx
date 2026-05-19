import type { Metadata } from 'next'
import { AlertsAndActions } from './alerts-and-actions'
import { CockpitHero } from './cockpit-hero'
import { DashboardPipeline } from './dashboard-pipeline'
import { DiagnosticsBreakdown } from './diagnostics-breakdown'
import { GainTrackerCard } from './gain-tracker-card'
import { RecentActivityBlock } from './recent-activity-block'
import { StatsDonutGrid } from './stats-donut-grid'
import { TodayBlock } from './today-block'

export const metadata: Metadata = { title: 'Tableau de bord' }

export default async function DashboardPage() {
  return (
    <div className="space-y-10 animate-fade-in">
      <CockpitHero />

      <TodayBlock />

      <DashboardPipeline />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          <StatsDonutGrid />
        </div>
        <div className="lg:col-span-4">
          <GainTrackerCard />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AlertsAndActions />
        <RecentActivityBlock />
        <DiagnosticsBreakdown />
      </div>
    </div>
  )
}
