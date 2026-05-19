'use client'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DashboardModeToggle, useDashboardMode } from '@/components/ui/dashboard-mode-toggle'
import { cn } from '@/lib/utils'
import { ArrowRight, MapPin } from 'lucide-react'
import Link from 'next/link'

interface NextMission {
  clientName: string
  time: string
  address: string
  href: string
}

interface CockpitHeroClientProps {
  firstName: string
  todayLabel: string
  visitsToday: number
  missionsDone7d: number
  docsReceived7d: number
  hoursSaved: number
  remainderMinutes: number
  eurosProductivity: number
  missionsDoneMonth: number
  nextMission: NextMission | null
  initialEffective: 'morning' | 'evening'
}

type HeroProps = Omit<CockpitHeroClientProps, 'initialEffective'>

export function CockpitHeroClient({ initialEffective, ...props }: CockpitHeroClientProps) {
  const { effective, hydrated } = useDashboardMode()
  const display = hydrated ? effective : initialEffective
  if (display === 'evening') {
    return <EveningHero {...props} />
  }
  return <MorningHero {...props} />
}

function MorningHero({
  firstName,
  todayLabel,
  visitsToday,
  missionsDone7d,
  docsReceived7d,
  nextMission,
}: HeroProps) {
  const tourHref = nextMission?.href ?? '/app/calendar'

  return (
    <section
      aria-label="Cockpit du matin"
      className="bg-fluid-cyan px-4 md:px-8 py-10 md:py-14 animate-fade-in"
    >
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-start justify-between gap-4">
          <p className="font-mono text-[11px] tracking-[0.1em] uppercase text-paper/85 capitalize">
            Bonjour {firstName} · {todayLabel}
          </p>
          <DashboardModeToggle className="border-paper/30 bg-paper/20 text-paper hover:bg-paper/30" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-7 items-start">
          <div>
            <p className="font-serif italic text-kpi-l md:text-[140px] text-paper leading-[0.85] tracking-tight drop-shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
              {visitsToday}
            </p>
            <p className="font-display font-light text-display-s md:text-[38px] text-paper -mt-2 max-w-lg leading-tight">
              {visitsToday <= 1 ? 'visite vous attend' : 'visites vous attendent'} 
              <span className="font-serif italic">aujourd&apos;hui</span>.
            </p>
            <p className="text-paper/90 max-w-md mt-3 text-[14px] leading-[1.55]">
              {visitsToday === 0 ? (
                'Aucune visite planifiée — bon moment pour finaliser vos exports.'
              ) : nextMission ? (
                <>
                  Première mission à{' '}
                  <span className="font-serif italic">{nextMission.time}</span> chez{' '}
                  <span className="font-serif italic">{nextMission.clientName}</span>.
                </>
              ) : (
                'Consultez le détail de vos visites ci-dessous.'
              )}
            </p>
            <div className="flex flex-wrap gap-3 mt-5">
              <Button asChild variant="accent" size="lg">
                <Link href={tourHref}>
                  Démarrer la tournée
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="glass" size="lg">
                <Link href="/app/calendar">Voir le planning</Link>
              </Button>
            </div>
          </div>

          {nextMission ? (
            <Card variant="glass" padding="default" className="w-full">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute mb-3">
                Prochaine mission
              </p>
              <p className="text-[22px] font-semibold text-ink tracking-tight mb-1">
                {nextMission.clientName}
              </p>
              <p className="text-[13px] text-ink-soft flex items-center gap-1.5 mb-4">
                <MapPin className="size-3.5 shrink-0" />
                {nextMission.address || 'Adresse à confirmer'}
              </p>
              <p className="font-serif italic text-3xl text-ink">{nextMission.time}</p>
              <Button asChild variant="default" size="sm" className="mt-5">
                <Link href={nextMission.href}>Ouvrir le dossier</Link>
              </Button>
            </Card>
          ) : null}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiPastel variant="cyan" label="Visites du jour" value={String(visitsToday)} unit="planifiées" />
          <KpiPastel variant="orange" label="Missions / 7j" value={String(missionsDone7d)} unit="terminées" />
          <KpiPastel variant="lime" label="Documents reçus" value={String(docsReceived7d)} unit="7 derniers jours" />
          <KpiPastel variant="coral" label="À facturer" value="—" unit="V1.5" />
        </div>
      </div>
    </section>
  )
}

function EveningHero({
  hoursSaved,
  remainderMinutes,
  eurosProductivity,
  missionsDoneMonth,
}: HeroProps) {
  const yearly = Math.round((hoursSaved + remainderMinutes / 60) * 12)

  return (
    <section
      aria-label="Cockpit du soir"
      className="bg-fluid-navy px-4 md:px-8 py-10 md:py-14 animate-fade-in"
    >
      <div className="max-w-6xl mx-auto relative">
        <div className="absolute top-0 right-0">
          <DashboardModeToggle className="glass-dark text-paper border-paper/20" />
        </div>

        <p className="font-mono text-[11px] tracking-[0.08em] uppercase text-paper/65 mb-4">
          Vous avez gagné ce mois
        </p>

        {missionsDoneMonth > 0 ? (
          <p className="font-serif italic text-kpi-l md:text-kpi-xl text-paper leading-[0.85] tracking-tight mb-6">
            {hoursSaved}h {String(remainderMinutes).padStart(2, '0')}
          </p>
        ) : (
          <p className="font-serif italic text-kpi-m text-paper/40 mb-6">—</p>
        )}

        {missionsDoneMonth > 0 ? (
          <p className="text-[15px] text-paper/85 max-w-xl leading-[1.55] mb-8">
            Soit{' '}
            <strong className="text-paper">{eurosProductivity.toLocaleString('fr-FR')}€</strong> de
            productivité libérée sur{' '}
            <strong className="text-paper">{missionsDoneMonth}</strong> mission
            {missionsDoneMonth > 1 ? 's' : ''}. À ce rythme,{' '}
            <strong className="text-paper">{yearly}h</strong> sur l&apos;année.
          </p>
        ) : (
          <p className="text-[15px] text-paper/70 max-w-xl mb-8">
            Terminez votre première mission ce mois pour voir votre gain cumulé.
          </p>
        )}

        <Button asChild variant="glass" className="border-paper/25 bg-paper/10 text-paper hover:bg-paper/20">
          <Link href="/app/gain">
            Voir le détail
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  )
}

function KpiPastel({
  variant,
  label,
  value,
  unit,
}: {
  variant: 'cyan' | 'orange' | 'lime' | 'coral'
  label: string
  value: string
  unit: string
}) {
  const bg = {
    cyan: 'bg-cyan-light/90',
    orange: 'bg-orange-mist',
    lime: 'bg-lime-mist',
    coral: 'bg-coral-mist',
  }[variant]

  return (
    <div className={cn('rounded-lg border border-paper/40 p-5', bg)}>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-mute mb-2">
        {label}
      </p>
      <p className="font-serif italic text-kpi-s text-ink leading-none mb-1">{value}</p>
      <p className="text-[12px] text-ink-mute">{unit}</p>
    </div>
  )
}
