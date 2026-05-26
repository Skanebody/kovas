import { AppPageHeader } from '@/components/app-page-header'
import { CalendarSyncDialog } from '@/components/calendar/calendar-sync-dialog'
import { getCurrentUser } from '@/lib/auth/current-user'
import { buildCalendarSubscriptionUrl, buildCalendarWebcalUrl } from '@/lib/calendar-token'
import type { CalendarEvent, OriginCoords } from '@/lib/calendar/shared'
import type { Metadata } from 'next'
import { CalendarView } from './calendar-view'

export const metadata: Metadata = { title: 'Planning' }

/**
 * Page calendrier — server component.
 *
 * Charge :
 *   - la fenêtre [now − 3 mois, now + 6 mois] de dossiers avec scheduled_at non null
 *   - les coordonnées `geo_lat` / `geo_lng` du dossier (issues de la migration
 *     scheduling) pour permettre le calcul Haversine des trajets en vue Jour
 *   - les coordonnées d'origine du cabinet (V1 : non stockées sur organizations
 *     ni profiles, donc `null` pour l'instant — fallback gracieux côté vue)
 *
 * Le rendu et la state machine vivent dans `<CalendarView>` (client).
 */
export default async function CalendarPage() {
  const { supabase, orgId } = await getCurrentUser()

  const now = new Date()
  const since = new Date(now)
  since.setMonth(since.getMonth() - 3)
  const until = new Date(now)
  until.setMonth(until.getMonth() + 6)

  // Types Supabase générés ne connaissent pas encore les colonnes `geo_lat` /
  // `geo_lng` (migration scheduling). Cast `as unknown` pour récupérer la
  // forme étendue — pattern aligné sur `lib/scheduling/clustering-suggester.ts`.
  interface DossierRow {
    id: string
    reference: string
    status: string
    scheduled_at: string
    geo_lat: number | string | null
    geo_lng: number | string | null
    properties:
      | { address: string | null; city: string | null }
      | { address: string | null; city: string | null }[]
      | null
    clients: { display_name: string | null } | { display_name: string | null }[] | null
    missions: { type: string }[] | null
  }

  const { data: dossiers } = await supabase
    .from('dossiers')
    .select(
      'id, reference, status, scheduled_at, geo_lat, geo_lng, properties(address, city), clients(display_name), missions(type)',
    )
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .not('scheduled_at', 'is', null)
    .gte('scheduled_at', since.toISOString())
    .lte('scheduled_at', until.toISOString())
    .order('scheduled_at', { ascending: true })

  const rows = (dossiers ?? []) as unknown as DossierRow[]

  const events: CalendarEvent[] = rows.map((d) => {
    const prop = Array.isArray(d.properties) ? d.properties[0] : d.properties
    const client = Array.isArray(d.clients) ? d.clients[0] : d.clients
    const missions = d.missions ?? []
    const latRaw = d.geo_lat
    const lngRaw = d.geo_lng
    const latitude = latRaw != null ? Number(latRaw) : null
    const longitude = lngRaw != null ? Number(lngRaw) : null
    return {
      dossierId: d.id,
      reference: d.reference,
      scheduledAt: d.scheduled_at,
      durationMinutes: 90, // V1 hard-codé, BDD `duration_minutes` à terme
      clientName: client?.display_name ?? null,
      address: prop?.address ?? null,
      city: prop?.city ?? null,
      missionTypes: missions.map((m) => m.type),
      status: d.status,
      latitude: latitude != null && Number.isFinite(latitude) ? latitude : null,
      longitude: longitude != null && Number.isFinite(longitude) ? longitude : null,
    }
  })

  // Origine tournée (cabinet / domicile) — non stockée en V1 sur organizations
  // ni profiles. Le calcul du premier trajet du matin sera donc absent pour
  // l'instant ; fallback gracieux côté vue (segment skipé si origin null).
  const origin: OriginCoords | null = null

  const httpsUrl = buildCalendarSubscriptionUrl(orgId)
  const webcalUrl = buildCalendarWebcalUrl(orgId)

  return (
    <div className="space-y-6 animate-fade-in">
      <AppPageHeader
        eyebrow="Planning"
        title="Votre"
        accent="planning"
        action={<CalendarSyncDialog httpsUrl={httpsUrl} webcalUrl={webcalUrl} />}
      />

      <CalendarView events={events} origin={origin} />
    </div>
  )
}
