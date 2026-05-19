import { resolveDashboardMode } from '@/lib/dashboard-mode'
import { parisDayBounds, parisMonthBounds } from '@/lib/paris-dates'
import { CockpitHeroClient } from './cockpit-hero-client'
import { getCurrentUser } from '@/lib/auth/current-user'

const MINUTES_SAVED_PER_MISSION = 90
const EUROS_PER_HOUR = 50

/**
 * Cockpit hero v3 — données serveur + rendu client (matin cyan / soir navy).
 */
export async function CockpitHero({ firstName }: { firstName: string }) {
  const { supabase, orgId } = await getCurrentUser()
  const { startIso, endIso } = parisDayBounds()
  const { startIso: monthStart, nextIso: monthEnd } = parisMonthBounds()
  const now = new Date()
  const w0 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    { count: visitsTodayCount },
    { data: firstDossier },
    { count: missionsDoneMonth },
    { count: missionsDone7d },
    { count: docsReceived7d },
  ] = await Promise.all([
    supabase
      .from('dossiers')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .gte('scheduled_at', startIso)
      .lte('scheduled_at', endIso),
    supabase
      .from('dossiers')
      .select(
        'id, scheduled_at, properties(address, city), clients(display_name), missions(type)',
      )
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .gte('scheduled_at', startIso)
      .lte('scheduled_at', endIso)
      .order('scheduled_at', { ascending: true })
      .limit(1),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .in('status', ['done', 'exported'])
      .gte('completed_at', monthStart)
      .lt('completed_at', monthEnd),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'done')
      .gte('completed_at', w0.toISOString()),
    supabase
      .from('owner_documents')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('uploaded_at', w0.toISOString()),
  ])

  const visitsToday = visitsTodayCount ?? 0
  const count = missionsDoneMonth ?? 0
  const totalMinutes = count * MINUTES_SAVED_PER_MISSION
  const hoursSaved = Math.floor(totalMinutes / 60)
  const remainderMinutes = totalMinutes % 60
  const eurosProductivity = Math.round((totalMinutes / 60) * EUROS_PER_HOUR)

  const first = firstDossier?.[0]
  const firstClient = first
    ? (Array.isArray(first.clients) ? first.clients[0] : first.clients)
    : null
  const prop = first
    ? (Array.isArray(first.properties) ? first.properties[0] : first.properties)
    : null
  const firstTime = first?.scheduled_at
    ? new Date(first.scheduled_at).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Paris',
      })
    : null

  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/Paris',
  })
  const initialEffective = resolveDashboardMode('auto', new Date())

  return (
    <div className="-mx-4 md:-mx-8 -mt-4 mb-8">
      <CockpitHeroClient
        initialEffective={initialEffective}
        firstName={firstName}
        todayLabel={todayLabel}
        visitsToday={visitsToday}
        missionsDone7d={missionsDone7d ?? 0}
        docsReceived7d={docsReceived7d ?? 0}
        hoursSaved={hoursSaved}
        remainderMinutes={remainderMinutes}
        eurosProductivity={eurosProductivity}
        missionsDoneMonth={count}
        nextMission={
          first && firstClient
            ? {
                clientName: firstClient.display_name,
                time: firstTime ?? '',
                address: prop
                  ? [prop.address, prop.city].filter(Boolean).join(', ')
                  : '',
                href: `/app/dossiers/${first.id}`,
              }
            : null
        }
      />
    </div>
  )
}
