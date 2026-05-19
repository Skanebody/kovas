import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { MISSION_TYPE_LABELS } from '@/lib/mission-helpers'
import { ArrowRight, CalendarClock, FileWarning, MapPin } from 'lucide-react'
import Link from 'next/link'
import { TodayMissionActions } from './today-mission-actions'

/**
 * Bornes du jour en timezone Europe/Paris.
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

/**
 * Mission types qui consomment au moins un document propriétaire utile.
 * Si un dossier contient ≥1 de ces types, on attend au moins 1 doc reçu.
 */
const DOC_RELEVANT_TYPES = new Set([
  'dpe_vente',
  'dpe_location',
  'copropriete',
  'amiante_vente',
  'amiante_avant_travaux',
  'plomb_crep',
])

export async function TodayBlock() {
  const { supabase, orgId } = await getCurrentUser()
  const { startIso, endIso } = todayBoundsParis()

  const { data: dossiers } = await supabase
    .from('dossiers')
    .select(
      'id, reference, status, scheduled_at, client_upload_token, properties(address, postal_code, city), clients(display_name, email, phone), missions(id, type, status), owner_documents(id)',
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
          <span className="flex items-center gap-3 text-xs font-normal">
            <span className="text-muted-foreground capitalize">{todayLabel}</span>
            <Link
              href="/app/calendar"
              className="text-cta hover:underline underline-offset-4 inline-flex items-center gap-1"
            >
              Voir le planning <ArrowRight className="size-3" />
            </Link>
          </span>
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
              const client = Array.isArray(d.clients) ? d.clients[0] : d.clients
              const missions = (d.missions ?? []) as {
                id: string
                type: string
                status: string
              }[]
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
              const fullAddress = prop
                ? [prop.address, prop.postal_code, prop.city].filter(Boolean).join(', ')
                : ''
              const docsReceived = (d.owner_documents ?? []).length
              const needsDocs = missions.some((m) => DOC_RELEVANT_TYPES.has(m.type))
              const docsMissing = needsDocs && docsReceived === 0
              const startHref = firstActive
                ? `/app/dossiers/${d.id}#mission-${firstActive.id}`
                : `/app/dossiers/${d.id}`

              return (
                <li key={d.id} className="px-4 py-3 hover:bg-muted/30 transition-colors space-y-2">
                  <div className="flex items-center gap-3 flex-wrap">
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
                        {docsMissing && (
                          <Badge variant="orange" className="text-[10px] py-0 gap-1">
                            <FileWarning className="size-3" />
                            Docs manquants
                          </Badge>
                        )}
                      </div>
                      {fullAddress && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                          <MapPin className="size-3 shrink-0" />
                          <span className="truncate">{fullAddress}</span>
                        </div>
                      )}
                      {client?.display_name && (
                        <div className="text-xs text-muted-foreground truncate">
                          {client.display_name}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1 flex-wrap pl-[3.75rem] sm:pl-0">
                    <TodayMissionActions
                      phone={client?.phone ?? null}
                      address={fullAddress}
                      dossierId={d.id}
                      uploadToken={d.client_upload_token ?? null}
                      docsMissing={docsMissing}
                    />
                    <Button size="sm" asChild>
                      <Link href={startHref}>
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
