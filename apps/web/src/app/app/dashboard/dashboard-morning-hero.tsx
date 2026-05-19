import { Button } from '@/components/ui/button'
import { getCurrentUser } from '@/lib/auth/current-user'
import { MISSION_TYPE_LABEL } from '@/lib/mission-pastels'
import type { MissionType } from '@kovas/shared'
import { ArrowRight, Plus } from 'lucide-react'
import Link from 'next/link'
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

const DOC_RELEVANT_TYPES = new Set([
  'dpe_vente',
  'dpe_location',
  'copropriete',
  'amiante_vente',
  'amiante_avant_travaux',
  'plomb_crep',
])

/**
 * Hero matin — mockup DS v1.0 §08 (grand chiffre serif + cards pastels).
 */
export async function DashboardMorningHero({
  firstName,
}: {
  firstName: string
}) {
  const { supabase, orgId } = await getCurrentUser()
  const { startIso, endIso } = todayBoundsParis()
  const now = new Date()
  const w0 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [{ data: dossiers }, { count: exportsWeek }] = await Promise.all([
    supabase
    .from('dossiers')
    .select(
      'id, reference, scheduled_at, properties(address, postal_code, city), clients(display_name), missions(id, type, status), owner_documents(id)',
    )
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .gte('scheduled_at', startIso)
    .lte('scheduled_at', endIso)
    .order('scheduled_at', { ascending: true }),
    supabase
      .from('missions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .is('deleted_at', null)
      .eq('status', 'exported')
      .gte('completed_at', w0.toISOString()),
  ])

  const list = dossiers ?? []
  const exportsCount = exportsWeek ?? 0
  const visitCount = list.length

  const first = list[0]
  const firstClient = first
    ? (Array.isArray(first.clients) ? first.clients[0] : first.clients)
    : null
  const firstTime = first?.scheduled_at
    ? new Date(first.scheduled_at).toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Europe/Paris',
      })
    : null
  const firstTypes = ((first?.missions ?? []) as { type: string }[])
    .slice(0, 2)
    .map((m) => MISSION_TYPE_LABEL[m.type as MissionType] ?? m.type)
    .join(' + ')

  let docsExpected = 0
  let docsReceived = 0
  for (const d of list) {
    const missions = (d.missions ?? []) as { type: string }[]
    if (missions.some((m) => DOC_RELEVANT_TYPES.has(m.type))) {
      docsExpected += 1
      if ((d.owner_documents ?? []).length > 0) docsReceived += 1
    }
  }

  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const firstHref = first
    ? `/app/dossiers/${first.id}`
    : '/app/calendar'

  return (
    <section className="space-y-8" aria-label="Cockpit du matin">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <p className="text-sm text-ink-mute capitalize">
          Bonjour {firstName} · {todayLabel}
        </p>
        <Button asChild variant="warm" size="lg" className="shrink-0">
          <Link href="/app/dossiers/new">
            <Plus className="size-4" /> Nouveau dossier
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <span className="font-serif italic text-7xl md:text-8xl leading-[0.9] tracking-tight text-cta">
          {visitCount}
        </span>
        <p className="text-display text-2xl md:text-3xl max-w-md leading-tight">
          {visitCount <= 1 ? 'visite vous attend' : 'visites vous attendent'}{' '}
          <span className="text-display-serif">aujourd&apos;hui</span>.
        </p>
      </div>

      <p className="text-ink-mute max-w-lg text-base -mt-2">
        {visitCount === 0 ? (
          'Aucune visite planifiée — bon moment pour finaliser vos exports ou préparer demain.'
        ) : firstTime && firstClient ? (
          <>
            Première mission à <strong className="text-foreground">{firstTime}</strong> chez{' '}
            <strong className="text-foreground">{firstClient.display_name}</strong>
            {firstTypes ? (
              <>
                . Préparez <span className="text-foreground">{firstTypes}</span>.
              </>
            ) : (
              '.'
            )}
          </>
        ) : (
          'Consultez le détail de vos visites ci-dessous.'
        )}
      </p>

      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href={firstHref}>
            {visitCount > 0 ? 'Démarrer la tournée' : 'Voir le planning'}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/app/calendar">Voir le planning</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <PastelStatCard
          label="Visites du jour"
          value={String(visitCount)}
          meta={visitCount === 1 ? '1 mission planifiée' : `${visitCount} missions planifiées`}
          pastel="butter"
        />
        <PastelStatCard
          label="Documents reçus"
          value={docsExpected > 0 ? `${docsReceived}/${docsExpected}` : '—'}
          meta={
            docsExpected > docsReceived
              ? `${docsExpected - docsReceived} dossier(s) en attente`
              : 'Tous les dossiers à jour'
          }
          pastel="peach"
        />
        <PastelStatCard
          label="Exports cette semaine"
          value={String(exportsCount)}
          meta={
            exportsCount === 1
              ? '1 export livré · 7 derniers jours'
              : `${exportsCount} exports livrés · 7 derniers jours`
          }
          pastel="lime"
        />
      </div>
    </section>
  )
}

function PastelStatCard({
  label,
  value,
  meta,
  pastel,
}: {
  label: string
  value: string
  meta: string
  pastel: 'butter' | 'lime' | 'peach'
}) {
  const bg =
    pastel === 'butter'
      ? 'bg-pastel-butter border-pastel-butter/30'
      : pastel === 'lime'
        ? 'bg-pastel-lime border-pastel-lime/30'
        : 'bg-pastel-peach border-pastel-peach/30'

  return (
    <div className={cn('rounded-xl border p-5', bg)}>
      <p className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-ink-mute mb-2">
        {label}
      </p>
      <p className="font-serif italic text-4xl leading-none tracking-tight text-foreground mb-1">
        {value}
      </p>
      <p className="text-sm text-ink-mute">{meta}</p>
    </div>
  )
}
