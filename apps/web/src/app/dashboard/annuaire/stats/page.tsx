/**
 * /dashboard/annuaire/stats — analytics fiche annuaire.
 *
 * Server Component pur. Sélection période via query param `?period=7d|30d|90d|1y`
 * (défaut 30d). 4 sections :
 *  1. Toggle période (PageTabs)
 *  2. 3 KPI hero (Vues fiche · Leads · Conversion) avec variation vs période N-1
 *  3. Sources de trafic (liste + barres horizontales)
 *  4. Réactivité (moyenne + 4 buckets)
 *  5. Benchmark zone (Walter delight : 4 critères avec décile)
 *
 * Data : V1 mock (cf. `lib/annuaire/mock-data.ts`). V1.5 = aggregat
 * `analytics_views` + `lead_assignments` + `quote_request_responses`.
 */

import { AppPageHeader } from '@/components/app-page-header'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { PageTabs } from '@/components/ui/page-tabs'
import {
  type AnnuaireStatsPeriod,
  PERIOD_LABELS,
  computeVariation,
  getAnnuaireStatsSnapshot,
  getClaimedDiagnosticianId,
  isAnnuaireStatsPeriod,
} from '@/lib/annuaire/mock-data'
import { getCurrentUser } from '@/lib/auth/current-user'
import { ArrowDownRight, ArrowUpRight, Clock, Eye, MousePointerClick, Sparkles } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Statistiques annuaire' }

interface PageProps {
  searchParams: Promise<{ period?: string }>
}

export default async function AnnuaireStatsPage({ searchParams }: PageProps) {
  const { user, supabase } = await getCurrentUser()
  const params = await searchParams
  const period: AnnuaireStatsPeriod = isAnnuaireStatsPeriod(params.period) ? params.period : '30d'

  const diagnosticianId = await getClaimedDiagnosticianId(supabase, user.id)
  const snapshot = await getAnnuaireStatsSnapshot(diagnosticianId, period)

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      <AppPageHeader
        title="Tes"
        accent="statistiques"
        eyebrow={PERIOD_LABELS[period]}
        description="Mesure l'impact de ta fiche annuaire : vues, leads reçus, conversion, et comparaison avec les diagnostiqueurs de ta zone."
      />

      <PeriodToggle active={period} />

      <KpiHeroGrid snapshot={snapshot} />

      <TrafficSourcesSection snapshot={snapshot} />

      <ResponseTimeSection snapshot={snapshot} />

      <ZoneBenchmarkSection snapshot={snapshot} />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* TOGGLE PÉRIODE                                                      */
/* ------------------------------------------------------------------ */

function PeriodToggle({ active }: { active: AnnuaireStatsPeriod }) {
  return (
    <PageTabs
      basePath="/dashboard/annuaire/stats"
      paramName="period"
      active={active}
      tabs={[
        { key: '7d', label: '7 jours' },
        { key: '30d', label: '30 jours' },
        { key: '90d', label: '90 jours' },
        { key: '1y', label: '12 mois' },
      ]}
    />
  )
}

/* ------------------------------------------------------------------ */
/* 3 KPI HERO                                                          */
/* ------------------------------------------------------------------ */

type Snapshot = Awaited<ReturnType<typeof getAnnuaireStatsSnapshot>>

function KpiHeroGrid({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <KpiHeroCard
        icon={<Eye className="size-4" strokeWidth={1.5} />}
        label="Vues de ta fiche"
        value={snapshot.views.value.toLocaleString('fr-FR')}
        variation={computeVariation(snapshot.views.value, snapshot.views.previousValue)}
      />
      <KpiHeroCard
        icon={<MousePointerClick className="size-4" strokeWidth={1.5} />}
        label="Leads reçus"
        value={snapshot.leads.value.toLocaleString('fr-FR')}
        variation={computeVariation(snapshot.leads.value, snapshot.leads.previousValue)}
      />
      <KpiHeroCard
        icon={<Sparkles className="size-4" strokeWidth={1.5} />}
        label="Conversion vues → leads"
        value={`${snapshot.conversionRate.value.toLocaleString('fr-FR')} %`}
        variation={computeVariation(
          snapshot.conversionRate.value,
          snapshot.conversionRate.previousValue,
        )}
      />
    </div>
  )
}

interface KpiHeroCardProps {
  icon: React.ReactNode
  label: string
  value: string
  /** Variation en % vs période précédente. */
  variation: number
}

function KpiHeroCard({ icon, label, value, variation }: KpiHeroCardProps) {
  const isPositive = variation >= 0
  const VariationIcon = isPositive ? ArrowUpRight : ArrowDownRight
  const formatted = `${isPositive ? '+' : ''}${variation.toLocaleString('fr-FR')} %`

  return (
    <Card variant="flat" padding="default" className="space-y-4">
      <div className="flex items-center gap-2 text-ink-mute">
        <span className="text-ink-mute" aria-hidden>
          {icon}
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.1em]">{label}</span>
      </div>
      <div className="space-y-1.5">
        <p className="font-serif italic font-normal text-[44px] md:text-[52px] leading-none tracking-tight text-ink">
          {value}
        </p>
        <div className="flex items-center gap-1.5">
          <Badge variant={isPositive ? 'green' : 'red'} className="font-mono text-[10px] gap-1">
            <VariationIcon className="size-3" strokeWidth={2} aria-hidden />
            {formatted}
          </Badge>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint">
            vs période précédente
          </span>
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ */
/* SOURCES DE TRAFIC                                                   */
/* ------------------------------------------------------------------ */

function TrafficSourcesSection({ snapshot }: { snapshot: Snapshot }) {
  const total = snapshot.trafficSources.reduce((sum, s) => sum + s.visits, 0)
  const max = Math.max(...snapshot.trafficSources.map((s) => s.visits), 1)

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-sans font-semibold text-[18px] text-ink leading-tight">
          Sources de trafic
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          {total.toLocaleString('fr-FR')} vues
        </span>
      </div>

      <Card variant="flat" padding="default" className="space-y-3">
        {snapshot.trafficSources.map((source) => {
          const pctOfTotal = total > 0 ? Math.round((source.visits / total) * 100) : 0
          const widthPct = (source.visits / max) * 100
          return (
            <div key={source.label} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14px] text-ink leading-tight">{source.label}</span>
                <span className="font-mono text-[12px] text-ink-mute tabular-nums">
                  {source.visits.toLocaleString('fr-FR')} · {pctOfTotal} %
                </span>
              </div>
              <div className="relative h-2 rounded-pill bg-sage-alt overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-pill bg-navy transition-all duration-base"
                  style={{ width: `${widthPct}%` }}
                />
              </div>
            </div>
          )
        })}
      </Card>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* RÉACTIVITÉ                                                          */
/* ------------------------------------------------------------------ */

function ResponseTimeSection({ snapshot }: { snapshot: Snapshot }) {
  const { averageMinutes, distribution } = snapshot.responseTime
  const max = Math.max(...distribution.map((b) => b.count), 1)
  const totalLeads = distribution.reduce((sum, b) => sum + b.count, 0)

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-sans font-semibold text-[18px] text-ink leading-tight">
          Réactivité aux leads
        </h2>
      </div>

      <Card variant="flat" padding="default" className="space-y-5">
        <div className="flex flex-wrap items-baseline gap-3">
          <Clock className="size-5 text-ink-mute" strokeWidth={1.5} aria-hidden />
          <div className="space-y-0.5">
            <p className="font-serif italic font-normal text-[36px] md:text-[44px] leading-none tracking-tight text-ink">
              {formatMinutes(averageMinutes)}
            </p>
            <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
              Temps de réponse moyen
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {distribution.map((bucket) => {
            const heightPct = (bucket.count / max) * 100
            const pctOfTotal = totalLeads > 0 ? Math.round((bucket.count / totalLeads) * 100) : 0
            return (
              <div
                key={bucket.label}
                className="flex flex-col gap-2 rounded-lg border border-rule/60 bg-sage-alt/40 p-3"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
                  {bucket.label}
                </span>
                <div className="relative h-16 flex items-end">
                  <div
                    className="w-full rounded-t bg-navy transition-all duration-base"
                    style={{ height: `${Math.max(heightPct, 6)}%` }}
                  />
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="font-mono text-[14px] font-semibold text-ink tabular-nums">
                    {bucket.count}
                  </span>
                  <span className="font-mono text-[10px] text-ink-faint tabular-nums">
                    {pctOfTotal} %
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </section>
  )
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  if (remaining === 0) return `${hours} h`
  return `${hours} h ${remaining.toString().padStart(2, '0')}`
}

/* ------------------------------------------------------------------ */
/* BENCHMARK ZONE (Walter delight)                                     */
/* ------------------------------------------------------------------ */

function ZoneBenchmarkSection({ snapshot }: { snapshot: Snapshot }) {
  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-sans font-semibold text-[18px] text-ink leading-tight">
          Ta place dans ta zone
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          Anonymisé · même département
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {snapshot.zoneBenchmark.map((row) => (
          <Card key={row.label} variant="flat" padding="default" className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
                  {row.label}
                </p>
                <p className="font-serif italic font-normal text-[28px] leading-none tracking-tight text-ink">
                  {row.displayValue}
                </p>
              </div>
              <PercentileBadge percentile={row.percentile} />
            </div>

            <div className="space-y-1">
              <div className="relative h-2 rounded-pill bg-sage-alt overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 rounded-pill bg-navy transition-all duration-base"
                  style={{ width: `${Math.round(row.positionRatio * 100)}%` }}
                />
              </div>
              <div className="flex justify-between font-mono text-[10px] text-ink-faint">
                <span>Moyenne zone</span>
                <span>Top du département</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-faint text-center">
        Comparaison basée sur les diagnostiqueurs actifs du même département · données agrégées
        anonymisées
      </p>
    </section>
  )
}

function PercentileBadge({ percentile }: { percentile: 10 | 25 | 50 }) {
  const variant = percentile === 10 ? 'green' : percentile === 25 ? 'blue' : 'muted'
  return (
    <Badge variant={variant} className="font-mono text-[10px] gap-1 shrink-0">
      Top {percentile} %
    </Badge>
  )
}
