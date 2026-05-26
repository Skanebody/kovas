import { BarChartPills } from '@/components/ui/bar-chart-pills'
import { Card } from '@/components/ui/card'
import type { EnergyDistributionRow } from '@/lib/observatoire/stats-aggregator'
import { ChartCaption } from './chart-caption'

interface EnergyDistributionProps {
  /** Lignes typées issues de `getEnergyDistribution()` — live ou fallback */
  rows: readonly EnergyDistributionRow[]
  /** Période courante affichée par le ChartCaption */
  periodLabel: string
}

/**
 * Section 3 — Distribution des classes énergétiques A-G par région.
 *
 * Source des chiffres : `getEnergyDistribution()` qui lit
 * `observatoire_live_stats.dpe_distribution` (jsonb) si disponible et retombe
 * sinon sur le référentiel `regions-data.ts` (mock 2024). Chaque card affiche
 * un badge discret "Donnée extrapolée" quand la région n'a pas de live data.
 *
 * V2 : remplacer par une carte de France SVG cliquable / hover-tooltip.
 */
export function EnergyDistribution({ rows, periodLabel }: EnergyDistributionProps) {
  const liveCount = rows.filter((r) => r.isLive).length
  const totalCount = rows.length
  const status: 'live' | 'fallback' = liveCount > 0 ? 'live' : 'fallback'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {rows.map((row) => {
          const data = [
            { label: 'A', value: row.distribution.a },
            { label: 'B', value: row.distribution.b },
            { label: 'C', value: row.distribution.c },
            { label: 'D', value: row.distribution.d },
            { label: 'E', value: row.distribution.e },
            { label: 'F', value: row.distribution.f },
            { label: 'G', value: row.distribution.g },
          ]
          const fg = row.distribution.f + row.distribution.g

          return (
            <Card
              key={row.regionCode}
              variant="flat"
              padding="sm"
              className="flex flex-col gap-2.5"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-[15px] font-semibold text-ink leading-tight">
                  {row.regionName}
                </h3>
                <span
                  className="font-mono text-[11px] text-ink-mute"
                  title="Part de logements F + G (passoires énergétiques)"
                >
                  F-G&nbsp;{fg} %
                </span>
              </div>
              <BarChartPills
                data={data}
                height={96}
                barWidth={16}
                gap={6}
                barColor="#1B405B"
                showDots={false}
                showValues
                maxLabel="% du parc"
              />
              {!row.isLive ? (
                <span className="inline-flex w-fit items-center rounded-pill bg-sage-alt px-2 py-[2px] font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
                  Donnée extrapolée
                </span>
              ) : null}
            </Card>
          )
        })}
      </div>

      <ChartCaption
        howToRead="Chaque barre représente la part (%) des logements diagnostiqués sur 12 mois glissants dans cette classe énergétique. Les classes F et G correspondent aux passoires énergétiques (consommation > 330 kWh/m²/an). Plus la barre F-G est haute, plus le parc régional nécessite de rénovations."
        source={
          status === 'live'
            ? `Base ADEME DPE consolidée + missions KOVAS anonymisées (${liveCount}/${totalCount} régions en données live)`
            : 'Référentiel ADEME 2024 — extrapolation en attente du prochain refresh mensuel'
        }
        dataStatus={status}
        periodLabel={periodLabel}
        axes={{ x: 'Classes énergétiques A à G', y: 'Part du parc régional (%)' }}
      />
    </div>
  )
}
