import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertsAndActions } from './alerts-and-actions'
import { DashboardPipeline } from './dashboard-pipeline'
import { DiagnosticsBreakdown } from './diagnostics-breakdown'
import { GainTrackerCard } from './gain-tracker-card'
import { RecentActivityBlock } from './recent-activity-block'
import { StatsDonutGrid } from './stats-donut-grid'
import { TodayBlock } from './today-block'

export const metadata: Metadata = { title: 'Tableau de bord' }

export default async function DashboardPage() {
  const { profile } = await getCurrentUser()
  const firstName = profile.full_name?.split(' ')[0] ?? 'à vous'

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-4">
      {/* Header compact */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="space-y-0.5">
          <h1 className="text-3xl font-extrabold tracking-tight">Bonjour {firstName}</h1>
          <p className="text-sm text-muted-foreground capitalize">{today}</p>
        </div>
        <Button asChild>
          <Link href="/app/dossiers/new">
            <Plus className="size-4" /> Nouveau dossier
          </Link>
        </Button>
      </div>

      {/* TodayBlock — vital matinal, full width */}
      <TodayBlock />

      {/* Pipeline Kanban semaine */}
      <DashboardPipeline />

      {/* Cockpit stats : 4 donuts + gain tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8">
          <StatsDonutGrid />
        </div>
        <div className="lg:col-span-4">
          <GainTrackerCard />
        </div>
      </div>

      {/* Row inférieure : alertes + activité + répartition */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AlertsAndActions />
        <RecentActivityBlock />
        <DiagnosticsBreakdown />
      </div>
    </div>
  )
}
