import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
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
  const { profile } = await getCurrentUser()
  const firstName = profile.full_name?.split(' ')[0] ?? 'à vous'

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2 max-w-xl">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Cockpit · <span className="capitalize">{today}</span>
          </p>
          <h1 className="text-display text-4xl md:text-5xl leading-[1.05]">
            Bonjour {firstName},{' '}
            <span className="text-display-serif">votre journée</span>
          </h1>
          <p className="text-muted-foreground text-base">
            Visites du jour, exports en attente et stats de la semaine — tout en un coup d&apos;œil.
          </p>
        </div>
        <Button asChild size="lg" className="shrink-0 self-start md:self-auto">
          <Link href="/app/dossiers/new">
            <Plus className="size-4" /> Nouveau dossier
          </Link>
        </Button>
      </header>

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
