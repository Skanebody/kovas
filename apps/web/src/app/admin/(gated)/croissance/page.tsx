import { ActivationStats } from '@/components/admin/growth/ActivationStats'
import { CohortRetentionTable } from '@/components/admin/growth/CohortRetentionTable'
import { ConversionFunnel } from '@/components/admin/growth/ConversionFunnel'
import { DauWauMauChart } from '@/components/admin/growth/DauWauMauChart'
import { GrowthMetricCard } from '@/components/admin/growth/GrowthMetricCard'
import { NPSSection } from '@/components/admin/growth/NPSSection'
import { SignupsChart } from '@/components/admin/growth/SignupsChart'
import { SourcesPieChart } from '@/components/admin/growth/SourcesPieChart'
import {
  getAcquisitionSources,
  getActivationRateByMonth,
  getCohortRetention,
  getConversionFunnel,
  getDauWauMau,
  getSignupsByDay,
} from '@/lib/admin/growth-analytics'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { Activity, BarChart3, CalendarDays, Sparkles, Target, Users } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Croissance',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'
export const revalidate = 0

function formatInt(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

function formatPct(ratio: number, fractionDigits = 1): string {
  return `${(ratio * 100).toFixed(fractionDigits)}%`
}

/**
 * Funnel period : on prend le 1er du mois -3 pour avoir une fenêtre meaningful
 * (recent enough to be actionable, large enough to have data).
 */
function funnelStartDate(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1))
}

export default async function CroissancePage() {
  const supabase = createAdminClient()

  const [signupsDaily, sources, funnel, cohorts, activationMonths, dauWauMau] = await Promise.all([
    getSignupsByDay(supabase, 30),
    getAcquisitionSources(supabase),
    getConversionFunnel(supabase, funnelStartDate()),
    getCohortRetention(supabase, 6),
    getActivationRateByMonth(supabase, 6),
    getDauWauMau(supabase),
  ])

  // Métriques header
  const signups30d = signupsDaily.reduce((acc, p) => acc + p.count, 0)
  const latestActivation = activationMonths[activationMonths.length - 1]
  const activationRate = latestActivation ? latestActivation.rate : 0

  // Trend signups : compare 15 derniers vs 15 précédents (approx).
  const half = Math.floor(signupsDaily.length / 2)
  const firstHalf = signupsDaily.slice(0, half).reduce((acc, p) => acc + p.count, 0)
  const secondHalf = signupsDaily.slice(half).reduce((acc, p) => acc + p.count, 0)
  const signupsTrend = firstHalf > 0 ? (secondHalf - firstHalf) / firstHalf : secondHalf > 0 ? 1 : 0

  // Sources stub-only ? (1 seul bucket = stub V1)
  const sourcesIsStub = sources.length <= 1

  const funnelStart = funnelStartDate()
  const funnelLabel = `depuis ${funnelStart.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })}`

  return (
    <div className="space-y-7 max-w-7xl">
      {/* Header */}
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          📈 Croissance · Acquisition &amp; rétention
        </p>
        <h1 className="font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-[1.05]">
          Croissance.
        </h1>
        <p className="text-sm text-ink-mute max-w-xl">
          Signups, activation, rétention par cohort, engagement (DAU/WAU/MAU). Vue 6 mois · fenêtre
          temporelle Europe/Paris.
        </p>
      </div>

      {/* KPI cards */}
      <section
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        aria-label="Métriques clés croissance"
      >
        <GrowthMetricCard
          eyebrow="Signups · 30j"
          value={formatInt(signups30d)}
          hint="Nouveaux comptes créés"
          icon={Sparkles}
          trend={signupsTrend}
          trendLabel="vs 15j précédents"
        />
        <GrowthMetricCard
          eyebrow="Taux activation"
          value={formatPct(activationRate, 1)}
          hint={
            latestActivation
              ? `${latestActivation.activated} / ${latestActivation.signups} (dernier mois)`
              : 'Aucune donnée'
          }
          icon={Target}
          trend={null}
          trendLabel="cible ≥ 55%"
        />
        <GrowthMetricCard
          eyebrow="DAU"
          value={formatInt(dauWauMau.dau)}
          hint="Actifs aujourd’hui"
          icon={Activity}
          trend={null}
        />
        <GrowthMetricCard
          eyebrow="WAU"
          value={formatInt(dauWauMau.wau)}
          hint="7 derniers jours"
          icon={CalendarDays}
          trend={null}
        />
        <GrowthMetricCard
          eyebrow="MAU"
          value={formatInt(dauWauMau.mau)}
          hint="30 derniers jours"
          icon={Users}
          trend={null}
        />
        <GrowthMetricCard
          eyebrow="Sticky ratio"
          value={formatPct(dauWauMau.stickyRatio, 1)}
          hint="DAU / MAU · cible ≥ 20%"
          icon={BarChart3}
          trend={null}
          trendLabel={dauWauMau.stickyRatio >= 0.2 ? '🟢 bonne traction' : '🟡 à surveiller'}
        />
      </section>

      {/* Signups trend + sources */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SignupsChart data={signupsDaily} />
        </div>
        <SourcesPieChart data={sources} isStub={sourcesIsStub} />
      </section>

      {/* Funnel + Cohorts */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <ConversionFunnel steps={funnel.steps} periodLabel={funnelLabel} />
        <CohortRetentionTable cohorts={cohorts} />
      </section>

      {/* Activation + DAU/WAU/MAU + NPS */}
      <section className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ActivationStats rows={activationMonths} />
        </div>
        <DauWauMauChart metrics={dauWauMau} />
      </section>

      <section>
        <NPSSection />
      </section>
    </div>
  )
}
