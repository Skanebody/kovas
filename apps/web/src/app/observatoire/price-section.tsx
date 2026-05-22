import { Card } from '@/components/ui/card'
import { DIAGNOSTICS, type DiagnosticType, type RegionInfo } from '@/lib/observatoire/regions-data'

interface PriceMatrixRow {
  region: string
  regionCode: string
  diagnosticsCount: number
  prices: Readonly<Record<DiagnosticType, number>>
}

interface PriceSectionProps {
  matrix: readonly PriceMatrixRow[]
  /** Régions complètes pour le bar chart par diag */
  regions: readonly RegionInfo[]
}

/**
 * Section 2 — Prix médian par diagnostic et par région.
 *
 * Desktop : tableau 13 régions × 8 diagnostics + colonne volume.
 * Mobile (< md) : transformation en cards par région.
 *
 * + mini cards de dispersion par diagnostic (8 cards) montrant min/médian/max
 * inter-régionale.
 */
export function PriceSection({ matrix, regions }: PriceSectionProps) {
  return (
    <div className="space-y-12">
      {/* Tableau desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-rule/60">
              <th className="text-left font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 font-medium py-3 px-3">
                Région
              </th>
              {DIAGNOSTICS.map((d) => (
                <th
                  key={d.code}
                  className="text-right font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 font-medium py-3 px-2"
                  title={d.longLabel}
                >
                  {d.label}
                </th>
              ))}
              <th className="text-right font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 font-medium py-3 px-3">
                Volume 12 m
              </th>
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr
                key={row.regionCode}
                className="border-b border-rule/40 hover:bg-paper/60 transition-colors"
              >
                <td className="py-3 px-3 font-medium text-ink">{row.region}</td>
                {DIAGNOSTICS.map((d) => (
                  <td key={d.code} className="py-3 px-2 text-right font-mono text-sm text-ink/85">
                    {row.prices[d.code]} €
                  </td>
                ))}
                <td className="py-3 px-3 text-right font-mono text-sm text-ink-mute">
                  {row.diagnosticsCount.toLocaleString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards mobile */}
      <div className="md:hidden space-y-4">
        {matrix.map((row) => (
          <Card key={row.regionCode} variant="flat" padding="sm">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-base font-semibold text-ink">{row.region}</h3>
              <span className="font-mono text-[11px] text-ink-mute">
                {row.diagnosticsCount.toLocaleString('fr-FR')} diags / an
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {DIAGNOSTICS.map((d) => (
                <div key={d.code} className="flex justify-between text-sm">
                  <dt className="text-ink-mute">{d.label}</dt>
                  <dd className="font-mono font-medium text-ink">{row.prices[d.code]} €</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </div>

      {/* Cards dispersion par diagnostic */}
      <div>
        <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 font-medium mb-6">
          Dispersion régionale (prix min · médian France · max)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {DIAGNOSTICS.map((d) => (
            <DiagDispersionCard key={d.code} diag={d.code} label={d.label} regions={regions} />
          ))}
        </div>
      </div>
    </div>
  )
}

function DiagDispersionCard({
  diag,
  label,
  regions,
}: {
  diag: DiagnosticType
  label: string
  regions: readonly RegionInfo[]
}) {
  const prices = regions.map((r) => r.prices[diag])
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const median = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length)

  return (
    <Card variant="flat" padding="sm" className="flex flex-col gap-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 font-medium">
        {label}
      </p>
      <div className="flex items-baseline gap-2">
        <span className="font-serif italic text-3xl text-ink leading-none">{median}</span>
        <span className="text-sm text-ink-mute">€ médian</span>
      </div>
      {/* Mini barre min-max */}
      <div className="relative h-1.5 bg-sage-alt rounded-full overflow-hidden">
        <div className="absolute h-full bg-navy/80 rounded-full left-0 w-full" />
      </div>
      <div className="flex justify-between font-mono text-[11px] text-ink-mute">
        <span>{min} €</span>
        <span>{max} €</span>
      </div>
    </Card>
  )
}
