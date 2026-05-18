import { InProgressMissions } from '@/components/in-progress-missions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { Building2, FolderOpen, Plus, Users } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { OverviewDonutsBlock } from './overview-donuts-block'
import { RecentActivityBlock } from './recent-activity-block'
import { RecentClientsBlock } from './recent-clients-block'
import { ToFinalizeBlock } from './to-finalize-block'
import { TodayBlock } from './today-block'
import { WeekStatsBlock } from './week-stats-block'

export const metadata: Metadata = { title: 'Tableau de bord' }

export default async function DashboardPage() {
  const { supabase, orgId, profile } = await getCurrentUser()
  const firstName = profile.full_name?.split(' ')[0] ?? 'à vous'

  const [{ count: dossiersCount }, { count: clientsCount }, { count: propertiesCount }] =
    await Promise.all([
      supabase
        .from('dossiers')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .is('deleted_at', null),
      supabase
        .from('clients')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .is('deleted_at', null),
      supabase
        .from('properties')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .is('deleted_at', null),
    ])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight">Bonjour {firstName}</h1>
          <p className="text-muted-foreground text-sm">
            {dossiersCount && dossiersCount > 0
              ? `${dossiersCount} dossier${dossiersCount > 1 ? 's' : ''} suivi${dossiersCount > 1 ? 's' : ''} au total.`
              : 'Bienvenue. Créez votre premier dossier ci-dessous.'}
          </p>
        </div>
        <Button asChild>
          <Link href="/app/dossiers/new">
            <Plus className="size-4" /> Nouveau dossier
          </Link>
        </Button>
      </div>

      <TodayBlock />

      <ToFinalizeBlock />

      <InProgressMissions />

      <WeekStatsBlock />

      <OverviewDonutsBlock />

      <RecentClientsBlock />

      <RecentActivityBlock />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={FolderOpen}
          label="Dossiers"
          value={dossiersCount ?? 0}
          href="/app/dossiers"
        />
        <StatCard icon={Users} label="Clients" value={clientsCount ?? 0} href="/app/clients" />
        <StatCard
          icon={Building2}
          label="Biens"
          value={propertiesCount ?? 0}
          href="/app/properties"
        />
      </div>
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  href: string
}) {
  return (
    <Link href={href} className="block">
      <Card className="hover:bg-muted/20 transition-colors">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Icon className="size-4" />
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold tracking-tight">{value}</div>
        </CardContent>
      </Card>
    </Link>
  )
}
