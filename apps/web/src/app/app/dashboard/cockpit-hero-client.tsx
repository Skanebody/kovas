'use client'

import { Card } from '@/components/ui/card'
import { DashboardModeToggle, useDashboardMode } from '@/components/ui/dashboard-mode-toggle'
import { cn } from '@/lib/utils'
import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface CockpitHeroClientProps {
  visitsToday: number
  missionsDoneMonth: number
  missionsDone7d: number
  docsReceived7d: number
  hoursSaved: number
  remainderMinutes: number
  eurosProductivity: number
}

/**
 * Cockpit Hero v3 client — bascule matin/soir/auto.
 *
 * MATIN (avant 14h Paris ou mode forcé) :
 *   - Hero KPI "{N} visites vous attendent aujourd'hui" en Instrument Serif italic
 *   - 4 cards pastels mist (Tournée / Compteur DPE / Documents reçus / À facturer)
 *
 * SOIR (après 14h Paris ou mode forcé) :
 *   - Hero GainTracker "{Xh Ymin} ce mois" sur card accent navy plein
 *   - Glow radial ambre, microcopy productivité euros
 */
export function CockpitHeroClient({
  visitsToday,
  missionsDoneMonth,
  missionsDone7d,
  docsReceived7d,
  hoursSaved,
  remainderMinutes,
  eurosProductivity,
}: CockpitHeroClientProps) {
  const { effective } = useDashboardMode()

  if (effective === 'evening') {
    return <EveningHero hoursSaved={hoursSaved} remainderMinutes={remainderMinutes} eurosProductivity={eurosProductivity} missionsDoneMonth={missionsDoneMonth} />
  }

  return (
    <MorningHero
      visitsToday={visitsToday}
      missionsDone7d={missionsDone7d}
      docsReceived7d={docsReceived7d}
    />
  )
}

function MorningHero({
  visitsToday,
  missionsDone7d,
  docsReceived7d,
}: { visitsToday: number; missionsDone7d: number; docsReceived7d: number }) {
  return (
    <section aria-label="Cockpit du matin" className="space-y-6 animate-fade-in">
      {/* Hero strate 1 — chiffre éditorial */}
      <Card variant="opaque" className="p-8 md:p-10 relative">
        <div className="absolute top-6 right-6">
          <DashboardModeToggle />
        </div>
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint mb-3">
          Cockpit matin
        </p>
        <div className="flex items-baseline gap-4 md:gap-6 flex-wrap">
          <span className="font-serif italic font-normal text-foreground leading-none tracking-tight text-7xl md:text-[7rem]">
            {visitsToday}
          </span>
          <span className="text-2xl md:text-3xl font-bold tracking-tight text-foreground max-w-md">
            {visitsToday === 0
              ? "aucune visite aujourd'hui"
              : visitsToday === 1
                ? "visite vous attend aujourd'hui"
                : "visites vous attendent aujourd'hui"}
          </span>
        </div>
        <p className="text-base text-ink-mute mt-4 max-w-xl">
          {visitsToday === 0
            ? 'Profitez-en pour finaliser vos exports et envoyer les rapports en attente.'
            : 'Consultez le détail dans « Vos visites » ci-dessous et démarrez votre tournée.'}
        </p>
      </Card>

      {/* Strate 2 — 4 cards pastels mist (signature v3) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <PastelMistStatCard
          pastelClass="bg-pastel-blue-mist"
          label="Tournée du jour"
          value={visitsToday.toString()}
          unit={
            visitsToday > 1
              ? 'visites planifiées'
              : visitsToday === 1
                ? 'visite planifiée'
                : "rien aujourd'hui"
          }
        />
        <PastelMistStatCard
          pastelClass="bg-pastel-orange-mist"
          label="Compteur DPE"
          value={missionsDone7d.toString()}
          unit="missions / 7 jours"
        />
        <PastelMistStatCard
          pastelClass="bg-pastel-lime-mist"
          label="Documents reçus"
          value={docsReceived7d.toString()}
          unit="7 derniers jours"
        />
        <PastelMistStatCard
          pastelClass="bg-pastel-coral-mist"
          label="À facturer"
          value="—"
          unit="V1.5"
        />
      </div>
    </section>
  )
}

function EveningHero({
  hoursSaved,
  remainderMinutes,
  eurosProductivity,
  missionsDoneMonth,
}: {
  hoursSaved: number
  remainderMinutes: number
  eurosProductivity: number
  missionsDoneMonth: number
}) {
  const yearly = Math.round((hoursSaved + remainderMinutes / 60) * 12)

  return (
    <section aria-label="Cockpit du soir" className="animate-fade-in">
      <Card
        variant="accent"
        className="relative overflow-hidden p-8 md:p-12 min-h-[320px] flex flex-col justify-between"
      >
        {/* Glow ambre radial v3 */}
        <div
          aria-hidden
          className="absolute -top-24 -right-24 size-96 rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, hsl(var(--accent-warm) / 0.20) 0%, transparent 65%)',
          }}
        />

        <div className="absolute top-6 right-6 z-10">
          <DashboardModeToggle />
        </div>

        <div className="relative">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-card-accent-foreground/65 mb-4">
            Vous avez gagné ce mois
          </p>

          {missionsDoneMonth > 0 ? (
            <p className="font-serif italic font-normal text-card-accent-foreground leading-[0.9] tracking-tight text-8xl md:text-[8rem] mb-6">
              {hoursSaved}h {String(remainderMinutes).padStart(2, '0')}
            </p>
          ) : (
            <p className="font-serif italic font-normal text-card-accent-foreground/40 leading-[0.9] tracking-tight text-7xl mb-6">
              —
            </p>
          )}

          {missionsDoneMonth > 0 ? (
            <p className="text-base md:text-lg text-card-accent-foreground/80 max-w-lg">
              Soit{' '}
              <span className="font-semibold text-card-accent-foreground">
                {eurosProductivity.toLocaleString('fr-FR')}€
              </span>{' '}
              de productivité libérée sur{' '}
              <span className="font-semibold text-card-accent-foreground">
                {missionsDoneMonth}
              </span>{' '}
              mission{missionsDoneMonth > 1 ? 's' : ''}. À ce rythme,{' '}
              <span className="font-semibold text-card-accent-foreground">{yearly}h</span> sur
              l&apos;année.
            </p>
          ) : (
            <p className="text-base md:text-lg text-card-accent-foreground/70 max-w-lg">
              Terminez votre première mission ce mois pour voir votre gain de temps cumulé.
            </p>
          )}
        </div>

        <div className="relative mt-8 flex gap-3 flex-wrap">
          <Link
            href="/app/gain"
            className={cn(
              'inline-flex items-center gap-2 self-start rounded-pill',
              'border border-card-accent-foreground/20 bg-card-accent-foreground/10',
              'backdrop-blur-md px-5 py-2.5 text-sm font-semibold',
              'text-card-accent-foreground transition-all duration-base',
              'hover:bg-card-accent-foreground/18 hover:-translate-y-px',
            )}
          >
            Voir le détail <ArrowRight className="size-4" />
          </Link>
        </div>
      </Card>
    </section>
  )
}

function PastelMistStatCard({
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
      <p className="font-serif italic font-normal text-4xl md:text-5xl leading-none tracking-tight text-foreground mb-1">
        {value}
      </p>
      <p className="text-sm text-ink-mute">{unit}</p>
    </div>
  )
}
