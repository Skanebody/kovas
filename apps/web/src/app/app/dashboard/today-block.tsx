import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import { ArrowRight, CalendarClock, MapPin } from 'lucide-react'
import Link from 'next/link'

/**
 * Bornes du jour en timezone Europe/Paris.
 * Stockage UTC ISO 8601 → on calcule [début_jour_local, fin_jour_local] côté serveur.
 */
function todayBoundsParis(): { startIso: string; endIso: string } {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parisDate = fmt.format(now)
  const start = new Date(`${parisDate}T00:00:00+02:00`)
  const end = new Date(`${parisDate}T23:59:59+02:00`)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

export async function TodayBlock() {
  const { supabase, orgId } = await getCurrentUser()
  const { startIso, endIso } = todayBoundsParis()

  const { data: dossiers } = await supabase
    .from('dossiers')
    .select(
      'id, reference, status, scheduled_at, properties(address, postal_code, city), missions(id, type, status)',
    )
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .gte('scheduled_at', startIso)
    .lte('scheduled_at', endIso)
    .order('scheduled_at', { ascending: true })

  const list = dossiers ?? []
  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <CalendarClock className="size-4" />
            Vos visites aujourd'hui ({list.length})
          </span>
          <span className="text-xs font-normal text-muted-foreground capitalize">{todayLabel}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {list.length === 0 ? (
          <p className="px-4 pb-5 text-sm text-muted-foreground">
            Aucune visite aujourd'hui. Profitez-en pour finaliser vos exports.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((d) => {
              const prop = Array.isArray(d.properties) ? d.properties[0] : d.properties
              const missions = (d.missions ?? []) as { id: string; type: string; status: string }[]
              const firstActive = missions.find(
                (m) => m.status !== 'done' && m.status !== 'cancelled',
              )
              const time = d.scheduled_at
                ? new Date(d.scheduled_at).toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Europe/Paris',
                  })
                : null
              return (
                <li key={d.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {time && (
                        <span className="text-base font-semibold tracking-tight shrink-0 w-14 tabular-nums">
                          {time}
                        </span>
                      )}
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-muted-foreground">
                            {d.reference}
                          </span>
                          {missions.slice(0, 3).map((m) => (
                            <Badge key={m.id} variant="muted" className="text-[10px] py-0">
                              {MISSION_TYPE_LABELS[m.type]?.split(' ')[0] ?? m.type}
                            </Badge>
                          ))}
                          {missions.length > 3 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{missions.length - 3}
                            </span>
                          )}
                        </div>
                        {prop?.address && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                            <MapPin className="size-3 shrink-0" />
                            <span className="truncate">
                              {prop.address}
                              {prop.city ? `, ${prop.postal_code ?? ''} ${prop.city}` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <Button size="sm" asChild>
                      <Link
                        href={
                          firstActive
                            ? `/app/dossiers/${d.id}#mission-${firstActive.id}`
                            : `/app/dossiers/${d.id}`
                        }
                      >
                        Démarrer <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
