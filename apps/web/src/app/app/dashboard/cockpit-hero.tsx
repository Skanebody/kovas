import { KpiHero } from '@/components/ui/kpi-hero'
import { getCurrentUser } from '@/lib/auth/current-user'

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

function trendPct(now: number, prev: number): number | null {
  if (prev === 0) return now > 0 ? 100 : null
  return Math.round(((now - prev) / prev) * 100)
}

/**
 * Cockpit matin — KPIs hero (registre Ron Design Lab × Tectra).
 * Première chose vue à l'ouverture du dashboard.
 */
export async function CockpitHero() {
  const { supabase, orgId } = await getCurrentUser()
  const { startIso, endIso } = todayBoundsParis()
  const now = new Date()
  const w0 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const w1 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const [
    { count: visitsToday },
    { count: doneNow },
    { count: donePrev },
    { count: docsNow },
    { count: docsPrev },
    { count: exportsNow },
  ] = await Promise.all([
    supabase
      .from('dossiers')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .gte('scheduled_at', startIso)
      .lte('scheduled_at', endIso),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'done')
      .gte('completed_at', w0.toISOString()),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'done')
      .gte('completed_at', w1.toISOString())
      .lt('completed_at', w0.toISOString()),
    supabase
      .from('owner_documents')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('uploaded_at', w0.toISOString()),
    supabase
      .from('owner_documents')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('uploaded_at', w1.toISOString())
      .lt('uploaded_at', w0.toISOString()),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'exported')
      .gte('completed_at', w0.toISOString()),
  ])

  const today = visitsToday ?? 0
  const done = doneNow ?? 0
  const docs = docsNow ?? 0
  const exports = exportsNow ?? 0

  return (
    <section aria-label="Cockpit du jour" className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <KpiHero
        featured
        value={today}
        label={today === 1 ? "visite prévue aujourd'hui" : "visites prévues aujourd'hui"}
        hint={
          today === 0
            ? 'Aucun RDV — bon moment pour finaliser vos exports'
            : 'Consultez le détail dans « Vos visites » ci-dessous'
        }
      />
      <KpiHero
        value={done}
        label="missions terminées"
        hint="7 derniers jours"
        trend={trendPct(done, donePrev ?? 0)}
      />
      <KpiHero
        value={docs}
        label="documents clients reçus"
        hint="7 derniers jours"
        trend={trendPct(docs, docsPrev ?? 0)}
      />
      <KpiHero value={exports} label="exports livrés" hint="7 derniers jours" />
    </section>
  )
}
