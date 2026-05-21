import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MissionCard } from '@/components/ui/mission-card'
import { getCurrentUser } from '@/lib/auth/current-user'
import type { MissionType } from '@kovas/shared'
import { ArrowRight, CalendarClock, FileWarning } from 'lucide-react'
import Link from 'next/link'
import { parisDayBounds } from '@/lib/paris-dates'
import { TodayMissionActions } from './today-mission-actions'

/**
 * Mission types qui consomment au moins un document propriétaire utile.
 */
const DOC_RELEVANT_TYPES = new Set([
  'dpe_vente',
  'dpe_location',
  'copropriete',
  'amiante_vente',
  'amiante_avant_travaux',
  'plomb_crep',
])

/**
 * Today block v2 (Design System v2 — 2026-05-19).
 * Liste les visites du jour avec composant MissionCard signature Ron
 * Design Lab : heure mono + tags pastels catégoriels + nom client +
 * adresse + slot actions (TodayMissionActions + StatusPill docs manquants).
 */
export async function TodayBlock() {
  const { supabase, orgId } = await getCurrentUser()
  const { startIso, endIso } = parisDayBounds()

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
    timeZone: 'Europe/Paris',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return (
    <Card variant="opaque" padding="default">
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-2">
            <CalendarClock className="size-4" />
            Vos visites aujourd&apos;hui ({list.length})
          </span>
          <span className="flex items-center gap-3 text-xs font-normal">
            <span className="text-ink-mute capitalize">{todayLabel}</span>
            <Link
              href="/app/calendar"
              className="text-ink hover:underline underline-offset-4 inline-flex items-center gap-1"
            >
              Voir le planning <ArrowRight className="size-3" />
            </Link>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {list.length === 0 ? (
          <div className="px-6 pb-8 pt-2 text-center">
            <p className="font-serif italic text-xl text-ink leading-relaxed max-w-md mx-auto">
              Journée libre. Profitez-en.
            </p>
            <p className="text-sm text-ink-mute mt-2 max-w-md mx-auto">
              Aucune visite planifiée aujourd&apos;hui. Bon moment pour finaliser vos exports en
              attente.
            </p>
          </div>
        ) : (
          <ul className="space-y-3 px-4 pb-4">
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
                : '—'
              const dayShort = d.scheduled_at
                ? new Date(d.scheduled_at).toLocaleDateString('fr-FR', {
                    weekday: 'short',
                    timeZone: 'Europe/Paris',
                  })
                : undefined
              const fullAddress = prop
                ? [prop.address, prop.postal_code, prop.city].filter(Boolean).join(', ')
                : ''
              const docsReceived = (d.owner_documents ?? []).length
              const needsDocs = missions.some((m) => DOC_RELEVANT_TYPES.has(m.type))
              const docsMissing = needsDocs && docsReceived === 0
              const startHref = firstActive
                ? `/app/dossiers/${d.id}#mission-${firstActive.id}`
                : `/app/dossiers/${d.id}`
              const missionTypes = missions.slice(0, 3).map((m) => m.type as MissionType)
              const clientName = client?.display_name ?? d.reference

              return (
                <li key={d.id}>
                  <MissionCard
                    time={time}
                    day={dayShort}
                    types={missionTypes}
                    name={clientName}
                    address={fullAddress || '—'}
                    actions={
                      <>
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
                      </>
                    }
                  />
                  {docsMissing && (
                    <Badge variant="orange" className="ml-6 mt-2 gap-1">
                      <FileWarning className="size-3" />
                      Documents manquants
                    </Badge>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
