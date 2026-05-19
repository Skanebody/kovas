import { GainTrackerCard } from '@/app/app/dashboard/gain-tracker-card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { GlassCard } from '@/components/ui/glass-card'
import { getCurrentUser } from '@/lib/auth/current-user'
import { parisMonthBounds } from '@/lib/paris-dates'
import { ArrowLeft, ChartLine } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Performance' }

const MINUTES_SAVED_PER_MISSION = 90
const EUROS_PER_HOUR = 50

/**
 * Performance v4 — Drama partiel (cf. doc wireframes §9).
 * Header + KPI hero grid en Drama navy + tables détail en Clear.
 *
 * KPIs hero strate 1 (Drama navy plein) :
 * - Missions ce mois (count)
 * - CA HT ce mois (placeholder V1.5)
 * - Temps moyen / mission (1h30 estimation V1)
 * - Productivité gagnée (calcul depuis missions × 1h30)
 *
 * Détail strate 2 (Clear) :
 * - Top clients V1.5 (placeholder)
 * - Évolution mensuelle V1.5 (placeholder graphique)
 */
export default async function GainPage() {
  const { supabase, orgId } = await getCurrentUser()
  const { startIso: monthStart, nextIso: monthNext } = parisMonthBounds()

  const { count: missionsDoneMonth } = await supabase
    .from('missions')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .in('status', ['done', 'exported'])
    .gte('completed_at', monthStart)
    .lt('completed_at', monthNext)

  const count = missionsDoneMonth ?? 0
  const totalMinutes = count * MINUTES_SAVED_PER_MISSION
  const hoursSaved = Math.floor(totalMinutes / 60)
  const remainderMinutes = totalMinutes % 60
  const eurosProductivity = Math.round((totalMinutes / 60) * EUROS_PER_HOUR)
  const avgMissionDuration = '1h30' // V1 hypothèse, mesure réelle V1.5
  const monthLabel = new Date().toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="-mx-4 md:-mx-8 -mt-4 animate-fade-in">
      {/* Strate 1 — Drama navy : Hero + KPIs */}
      <section className="bg-fluid-navy px-4 md:px-8 py-10 md:py-14 space-y-8">
        <Button
          variant="glass"
          size="sm"
          asChild
          className="border-paper/25 bg-paper/10 text-paper hover:bg-paper/20"
        >
          <Link href="/app/dashboard">
            <ArrowLeft className="size-4" /> Tableau de bord
          </Link>
        </Button>

        <div className="max-w-3xl space-y-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-paper/65 capitalize">
            Performance · {monthLabel}
          </p>
          <h1 className="font-sans font-light text-display-m text-paper tracking-tight">
            Votre <span className="font-serif italic">gain de temps</span>.
          </h1>
          <p className="text-[14px] text-paper/80 leading-[1.55] max-w-xl">
            Estimation basée sur les missions terminées ce mois (1h30 économisée par diagnostic
            type DPE vs saisie manuelle).
          </p>
        </div>

        {/* KPI hero grid 4 cards Drama (variant glass dark) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 max-w-6xl">
          <GlassCard variant="dark" padding="md">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-paper/60 mb-2">
              Missions
            </p>
            <p className="font-serif italic text-5xl md:text-6xl leading-none tracking-tight text-paper mb-1">
              {count}
            </p>
            <p className="text-xs text-paper/65">ce mois</p>
          </GlassCard>

          <GlassCard variant="dark" padding="md">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-paper/60 mb-2">
              Productivité gagnée
            </p>
            <p className="font-serif italic text-5xl md:text-6xl leading-none tracking-tight text-paper mb-1">
              {hoursSaved}h
              <span className="text-2xl md:text-3xl">
                {String(remainderMinutes).padStart(2, '0')}
              </span>
            </p>
            <p className="text-xs text-paper/65">à 1h30 par mission</p>
          </GlassCard>

          <GlassCard variant="dark" padding="md">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-paper/60 mb-2">
              Temps moyen / mission
            </p>
            <p className="font-serif italic text-5xl md:text-6xl leading-none tracking-tight text-paper mb-1">
              {avgMissionDuration}
            </p>
            <p className="text-xs text-paper/65">économisé vs Word</p>
          </GlassCard>

          <GlassCard variant="dark" padding="md">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-paper/60 mb-2">
              Productivité €
            </p>
            <p className="font-serif italic text-5xl md:text-6xl leading-none tracking-tight text-paper mb-1">
              {eurosProductivity.toLocaleString('fr-FR')}€
            </p>
            <p className="text-xs text-paper/65">à 50€/h estimé</p>
          </GlassCard>
        </div>
      </section>

      {/* Strate 2 — Clear : GainTracker hero card + détail V1.5 */}
      <section className="px-4 md:px-8 py-10 space-y-8">
        <div className="max-w-3xl">
          <GainTrackerCard />
        </div>

        <EmptyState
          icon={ChartLine}
          title="Évolution mensuelle bientôt."
          description="Graphique 12 mois, missions par diagnostic, top clients, CA mensuel. Disponible en V1.5."
        />
      </section>
    </div>
  )
}
