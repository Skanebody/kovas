import { Building2, FolderOpen, Plus, Users } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { InProgressMissions } from '@/components/in-progress-missions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'

export const metadata: Metadata = { title: 'Tableau de bord' }

const DOSSIER_STATUS_LABELS: Record<string, string> = {
  draft: 'Brouillon',
  scheduled: 'Planifié',
  on_site: 'Sur place',
  back_office: 'Au bureau',
  done: 'Terminé',
  archived: 'Archivé',
  cancelled: 'Annulé',
}

const DOSSIER_STATUS_VARIANT: Record<string, 'muted' | 'blue' | 'green' | 'orange' | 'red'> = {
  draft: 'muted',
  scheduled: 'blue',
  on_site: 'orange',
  back_office: 'orange',
  done: 'green',
  archived: 'muted',
  cancelled: 'red',
}

export default async function DashboardPage() {
  const { supabase, orgId, profile } = await getCurrentUser()
  const firstName = profile.full_name?.split(' ')[0] ?? 'à vous'

  const [
    { count: dossiersCount },
    { count: clientsCount },
    { count: propertiesCount },
    { data: recentDossiers },
  ] = await Promise.all([
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
    supabase
      .from('dossiers')
      .select('id, reference, status, scheduled_at, properties(address), missions(type)')
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Bonjour {firstName}</h1>
          <p className="text-muted-foreground">
            {dossiersCount && dossiersCount > 0
              ? `${dossiersCount} dossier${dossiersCount > 1 ? 's' : ''} au total.`
              : 'Bienvenue. Créez votre premier dossier ci-dessous.'}
          </p>
        </div>
        <Button asChild>
          <Link href="/app/dossiers/new">
            <Plus className="size-4" /> Nouveau dossier
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={FolderOpen}
          label="Dossiers"
          value={dossiersCount ?? 0}
          href="/app/dossiers"
        />
        <StatCard
          icon={Users}
          label="Clients"
          value={clientsCount ?? 0}
          href="/app/clients"
        />
        <StatCard
          icon={Building2}
          label="Biens"
          value={propertiesCount ?? 0}
          href="/app/properties"
        />
      </div>

      <InProgressMissions />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Dossiers récents</h2>
          {recentDossiers && recentDossiers.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/app/dossiers">Tous les dossiers</Link>
            </Button>
          )}
        </div>
        {recentDossiers && recentDossiers.length > 0 ? (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {recentDossiers.map((d) => {
                  const prop = Array.isArray(d.properties) ? d.properties[0] : d.properties
                  const missions = (d.missions ?? []) as { type: string }[]
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/app/dossiers/${d.id}`}
                          className="font-medium hover:underline font-mono text-xs"
                        >
                          {d.reference}
                        </Link>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {missions
                            .map((m) => MISSION_TYPE_LABELS[m.type]?.split(' ')[0] ?? m.type)
                            .slice(0, 4)
                            .join(' · ')}
                          {missions.length > 4 ? ` (+${missions.length - 4})` : ''}
                          {prop?.address ? ` · ${prop.address}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant={DOSSIER_STATUS_VARIANT[d.status] ?? 'muted'}>
                          {DOSSIER_STATUS_LABELS[d.status] ?? d.status}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 pb-8 text-center space-y-3 text-sm text-muted-foreground">
              Aucun dossier encore. Créez votre premier pour commencer.
            </CardContent>
          </Card>
        )}
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
