/**
 * RevenueForecastSection — 4 KPI cards CA prévisionnel + réalisé.
 *
 * Source : `mission_pricing_snapshots` (status='estimated' pour forecast,
 * 'mission_done' pour réalisé, fenêtre 30j).
 */

import { formatEur } from '@/components/admin/finance/finance-format'
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import type { RevenueForecast, RevenueRealized } from '@/lib/admin/revenue-metrics'
import { CalendarClock, CheckCircle2, Percent, ShoppingBag } from 'lucide-react'

export interface RevenueForecastSectionProps {
  forecast: RevenueForecast
  realized: RevenueRealized
}

export function RevenueForecastSection({ forecast, realized }: RevenueForecastSectionProps) {
  const realizedVsForecast =
    forecast.forecastTtc > 0
      ? Math.round((realized.realizedTtc / forecast.forecastTtc) * 1000) / 10
      : 0

  return (
    <section className="space-y-4" aria-label="Revenue forecast & realized">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">
          📊 Revenue — prévisionnel & réalisé
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          fenêtre 30 jours · snapshots immutables
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <AdminMetricCard
          eyebrow="CA prévisionnel 30j"
          value={formatEur(forecast.forecastTtc)}
          hint={`${forecast.count} missions estimées (TTC)`}
          icon={CalendarClock}
        />
        <AdminMetricCard
          eyebrow="CA réalisé 30j"
          value={formatEur(realized.realizedTtc)}
          hint={`${realized.count} missions terminées (TTC)`}
          comparison={
            realizedVsForecast > 0
              ? `${realizedVsForecast}% du prévisionnel converti`
              : 'aucun snapshot terminé'
          }
          icon={CheckCircle2}
        />
        <AdminMetricCard
          eyebrow="Panier moyen"
          value={formatEur(realized.avgTicketTtc)}
          hint={`prévisionnel : ${formatEur(forecast.avgTicketTtc)}`}
          icon={ShoppingBag}
        />
        <AdminMetricCard
          eyebrow="Marge KOVAS"
          value={formatEur(realized.marginEstimate)}
          hint="V1 : pas de commission. V2 Phase 2 Cabinet."
          icon={Percent}
        />
      </div>
    </section>
  )
}
