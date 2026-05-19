import { Card } from '@/components/ui/card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { cn } from '@/lib/utils'

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
 * Cockpit matin v2 — strate 1 du dashboard.
 * Pattern Ron Design Lab : 1 hero KPI + 3 cards pastels catégoriels.
 *
 * - Hero : nombre de visites du jour en Instrument Serif italic 96px
 * - 3 cards pastels : tournée km, missions terminées 7j, exports livrés 7j
 */
export async function CockpitHero() {
  const { supabase, orgId } = await getCurrentUser()
  const { startIso, endIso } = todayBoundsParis()
  const now = new Date()
  const w0 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [{ count: visitsToday }, { count: doneNow }, { count: docsReceived }] = await Promise.all([
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
      .from('owner_documents')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('uploaded_at', w0.toISOString()),
  ])

  const today = visitsToday ?? 0

  return (
    <section aria-label="Cockpit du jour" className="space-y-6">
      {/* Hero strate 1 — chiffre éditorial */}
      <Card variant="flat" className="p-8 md:p-10">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint mb-3">
          Cockpit matin
        </p>
        <div className="flex items-baseline gap-4 md:gap-6 flex-wrap">
          <span className="font-serif italic font-normal text-foreground leading-none tracking-tight text-7xl md:text-8xl">
            {today}
          </span>
          <span className="text-2xl md:text-3xl font-bold tracking-tight text-foreground max-w-md">
            {today === 0
              ? 'aucune visite aujourd\'hui'
              : today === 1
              ? 'visite vous attend aujourd\'hui'
              : 'visites vous attendent aujourd\'hui'}
          </span>
        </div>
        <p className="text-base text-ink-mute mt-4 max-w-xl">
          {today === 0
            ? 'Profitez-en pour finaliser vos exports et envoyer les rapports en attente.'
            : 'Consultez le détail dans « Vos visites » ci-dessous et démarrez votre tournée.'}
        </p>
      </Card>

      {/* Strate 2 — 3 cards pastels catégoriels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <PastelStatCard
          pastelClass="bg-pastel-butter"
          label="Tournée du jour"
          value={today.toString()}
          unit={today > 1 ? 'visites planifiées' : today === 1 ? 'visite planifiée' : 'rien aujourd\'hui'}
        />
        <PastelStatCard
          pastelClass="bg-pastel-lime"
          label="Missions terminées"
          value={(doneNow ?? 0).toString()}
          unit="7 derniers jours"
        />
        <PastelStatCard
          pastelClass="bg-pastel-sky"
          label="Documents clients reçus"
          value={(docsReceived ?? 0).toString()}
          unit="7 derniers jours"
        />
      </div>
    </section>
  )
}

function PastelStatCard({
  pastelClass,
  label,
  value,
  unit,
}: {
  pastelClass: string
  label: string
  value: string
  unit: string
}) {
  return (
    <div className={cn('rounded-xl border border-border-soft p-5', pastelClass)}>
      <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.05em] text-ink-mute mb-2">
        {label}
      </p>
      <p className="font-serif italic font-normal text-4xl leading-none tracking-tight text-foreground mb-1">
        {value}
      </p>
      <p className="text-sm text-ink-mute">{unit}</p>
    </div>
  )
}
