import { BarChartPills } from '@/components/ui/bar-chart-pills'
import { Card } from '@/components/ui/card'
import type { RegionInfo } from '@/lib/observatoire/regions-data'

interface EnergyDistributionProps {
  regions: readonly RegionInfo[]
}

/**
 * Section 3 — Distribution des classes énergétiques A-G par région.
 *
 * Implémentation V1 : 13 mini bar-charts pilules verticales (pattern signature
 * v5 — voir `BarChartPills`), un par région, avec les 7 classes A-G en abscisse
 * et le pourcentage en ordonnée.
 *
 * V2 : remplacer par une carte de France SVG cliquable / hover-tooltip.
 */
export function EnergyDistribution({ regions }: EnergyDistributionProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {regions.map((region) => {
        const data = [
          { label: 'A', value: region.energyDistribution.a },
          { label: 'B', value: region.energyDistribution.b },
          { label: 'C', value: region.energyDistribution.c },
          { label: 'D', value: region.energyDistribution.d },
          { label: 'E', value: region.energyDistribution.e },
          { label: 'F', value: region.energyDistribution.f },
          { label: 'G', value: region.energyDistribution.g },
        ]
        const fg = region.energyDistribution.f + region.energyDistribution.g

        return (
          <Card key={region.code} variant="flat" padding="sm" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h3 className="text-base font-semibold text-ink leading-tight">{region.name}</h3>
              <span
                className="font-mono text-[11px] text-ink-mute"
                title="Part de logements F + G"
              >
                F-G&nbsp;{fg} %
              </span>
            </div>
            <BarChartPills
              data={data}
              height={120}
              barWidth={18}
              gap={8}
              barColor="#1B405B"
              showDots={false}
              showValues
              maxLabel="Max 35 %"
            />
          </Card>
        )
      })}
    </div>
  )
}
