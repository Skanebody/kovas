import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { CockpitHeroClient } from './cockpit-hero-client'

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

function monthBoundsParis(): { startIso: string; nextIso: string } {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
  })
  const parts = fmt.formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const start = new Date(`${year}-${month}-01T00:00:00+02:00`)
  const next = new Date(start)
  next.setMonth(next.getMonth() + 1)
  return { startIso: start.toISOString(), nextIso: next.toISOString() }
}

const MINUTES_SAVED_PER_MISSION = 90 // CLAUDE.md §2 (1h30/mission)
const EUROS_PER_HOUR_PRODUCTIVITY = 50

/**
 * Cockpit Hero v3 — server component (data fetch) délègue au client
 * pour la bascule matin/soir via DashboardModeToggle.
 *
 * Fetch mutualisé : visites du jour + missions du mois + docs reçus.
 * Le client decide quel hero afficher selon le mode resolu.
 */
export async function CockpitHero() {
  const { supabase, orgId } = await getCurrentUser()
  const { startIso: dayStart, endIso: dayEnd } = todayBoundsParis()
  const { startIso: monthStart, nextIso: monthNext } = monthBoundsParis()
  const w0 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    { count: visitsToday },
    { count: missionsDoneMonth },
    { count: docsReceived7d },
    { count: missionsDone7d },
  ] = await Promise.all([
    supabase
      .from('dossiers')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .gte('scheduled_at', dayStart)
      .lte('scheduled_at', dayEnd),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .in('status', ['done', 'exported'])
      .gte('completed_at', monthStart)
      .lt('completed_at', monthNext),
    supabase
      .from('owner_documents')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('uploaded_at', w0.toISOString()),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'done')
      .gte('completed_at', w0.toISOString()),
  ])

  const totalMinutes = (missionsDoneMonth ?? 0) * MINUTES_SAVED_PER_MISSION
  const hoursSaved = Math.floor(totalMinutes / 60)
  const remainderMinutes = totalMinutes % 60
  const eurosProductivity = Math.round((totalMinutes / 60) * EUROS_PER_HOUR_PRODUCTIVITY)

  return (
    <CockpitHeroClient
      visitsToday={visitsToday ?? 0}
      missionsDoneMonth={missionsDoneMonth ?? 0}
      missionsDone7d={missionsDone7d ?? 0}
      docsReceived7d={docsReceived7d ?? 0}
      hoursSaved={hoursSaved}
      remainderMinutes={remainderMinutes}
      eurosProductivity={eurosProductivity}
    />
  )
}

/**
 * Mode fallback minimal côté serveur si JS désactivé (rare en PWA).
 * Inutile en pratique car CockpitHeroClient gère tout, mais on garde
 * une Card vide pour éviter un layout shift initial.
 */
export function CockpitHeroSkeleton() {
  return <Card variant="opaque" className="p-8 md:p-10 min-h-[320px]" aria-busy="true" />
}
