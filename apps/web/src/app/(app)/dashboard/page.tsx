import { Building2, FileText, Plus, Users } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  MISSION_STATUS_LABELS,
  MISSION_STATUS_VARIANT,
  MISSION_TYPE_LABELS,
} from '@/lib/mission-helpers'

export const metadata: Metadata = { title: 'Tableau de bord' }

export default async function DashboardPage() {
  const { supabase, orgId, profile } = await getCurrentUser()
  const firstName = profile.full_name?.split(' ')[0] ?? 'à vous'

  const [
    { count: missionsCount },
    { count: clientsCount },
    { count: propertiesCount },
    { data: recentMissions },
  ] = await Promise.all([
    supabase
      .from('missions')
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
      .from('missions')
      .select('id, reference, type, status, scheduled_at, properties(address)')
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
            {missionsCount && missionsCount > 0
              ? `${missionsCount} mission${missionsCount > 1 ? 's' : ''} au total.`
              : 'Bienvenue. Créez votre première mission ci-dessous.'}
          </p>
        </div>
        <Button asChild>
          <Link href="/app/missions/new">
            <Plus className="size-4" /> Nouvelle mission
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={FileText} label="Missions" value={missionsCount ?? 0} href="/app/missions" />
        <StatCard icon={Users} label="Clients" value={clientsCount ?? 0} href="/app/clients" />
        <StatCard icon={Building2} label="Biens" value={propertiesCount ?? 0} href="/app/properties" />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Missions récentes</h2>
          {recentMissions && recentMissions.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/app/missions">Toutes les missions</Link>
            </Button>
          )}
        </div>
        {recentMissions && recentMissions.length > 0 ? (
          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {recentMissions.map((m) => {
                  const prop = Array.isArray(m.properties) ? m.properties[0] : m.properties
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/app/missions/${m.id}`}
                          className="font-medium hover:underline"
                        >
                          {m.reference}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {MISSION_TYPE_LABELS[m.type] ?? m.type}
                          {prop?.address ? ` · ${prop.address}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Badge variant={MISSION_STATUS_VARIANT[m.status] ?? 'muted'}>
                          {MISSION_STATUS_LABELS[m.status] ?? m.status}
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
              Aucune mission encore. Créez votre première pour commencer.
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
