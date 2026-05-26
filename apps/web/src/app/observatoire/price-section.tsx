import { Card } from '@/components/ui/card'
import { DIAGNOSTICS, type DiagnosticType, type RegionInfo } from '@/lib/observatoire/regions-data'
import type { PriceMatrixRow } from '@/lib/observatoire/stats-aggregator'
import { ChartCaption } from './chart-caption'

interface PriceSectionProps {
  matrix: readonly PriceMatrixRow[]
  /** Régions complètes pour le bar chart par diag */
  regions: readonly RegionInfo[]
  /** Période courante affichée par le ChartCaption */
  periodLabel: string
}

/**
 * Section 2 — Prix médian par diagnostic et par région.
 *
 * Desktop : tableau 13 régions × 8 diagnostics + colonne volume.
 * Mobile (< md) : transformation en cards par région.
 *
 * + mini cards de dispersion par diagnostic (8 cards) montrant min/médian/max
 * inter-régionale.
 *
 * Statut data : la colonne DPE est branchée sur la DB live region par region
 * (`PriceMatrixRow.dpeIsLive`). Les 7 autres diagnostics restent issus du
 * référentiel mocké jusqu'au prochain enrichissement Edge Function (V2).
 * Un puce discrète indique aux journalistes/chercheurs le statut par ligne.
 */
export function PriceSection({ matrix, regions, periodLabel }: PriceSectionProps) {
  const liveDpeCount = matrix.filter((r) => r.dpeIsLive).length
  const status: 'live' | 'fallback' = liveDpeCount > 0 ? 'live' : 'fallback'

  return (
    <div className="space-y-8">
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
                <td className="py-2.5 px-3 font-medium text-ink">
                  <span className="inline-flex items-center gap-2">
                    {row.region}
                    {row.dpeIsLive ? (
                      <span
                        className="size-1.5 rounded-full bg-chartreuse-deep"
                        aria-label="Région avec DPE en données live"
                      />
                    ) : null}
                  </span>
                </td>
                {DIAGNOSTICS.map((d) => (
                  <td
                    key={d.code}
                    className="py-2.5 px-2 text-right font-mono text-[13px] text-ink/85"
                  >
                    {row.prices[d.code]} €
                  </td>
                ))}
                <td className="py-2.5 px-3 text-right font-mono text-[13px] text-ink-mute">
                  {row.diagnosticsCount.toLocaleString('fr-FR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards mobile */}
      <div className="md:hidden space-y-3">
        {matrix.map((row) => (
          <Card key={row.regionCode} variant="flat" padding="sm">
            <div className="flex items-baseline justify-between mb-2.5">
              <h3 className="text-[15px] font-semibold text-ink inline-flex items-center gap-2">
                {row.region}
                {row.dpeIsLive ? (
                  <span
                    className="size-1.5 rounded-full bg-chartreuse-deep"
                    aria-label="DPE live"
                  />
                ) : null}
              </h3>
              <span className="font-mono text-[11px] text-ink-mute">
                {row.diagnosticsCount.toLocaleString('fr-FR')} diags / an
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
              {DIAGNOSTICS.map((d) => (
                <div key={d.code} className="flex justify-between text-[13px]">
                  <dt className="text-ink-mute">{d.label}</dt>
                  <dd className="font-mono font-medium text-ink">{row.prices[d.code]} €</dd>
                </div>
              ))}
            </dl>
          </Card>
        ))}
      </div>

      {/* Cards dispersion par diagnostic */}
      <div className="space-y-4">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 font-medium">
          Dispersion régionale — prix min · médian France · max
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DIAGNOSTICS.map((d) => (
            <DiagDispersionCard key={d.code} diag={d.code} label={d.label} regions={regions} />
          ))}
        </div>
      </div>

      <ChartCaption
        howToRead={`La colonne avec un point chartreuse à côté du nom de région indique un prix DPE issu de la base live (${liveDpeCount}/${matrix.length} régions). Les 7 autres diagnostics (amiante, plomb, gaz, électricité, termites, Carrez, ERP) restent des médians de référence du marché 2024 en attendant l'enrichissement progressif. Les écarts régionaux reflètent le coût du foncier et la densité du tissu professionnel.`}
        source={
          status === 'live'
            ? 'Missions KOVAS anonymisées (DPE) + référentiel marché ADEME / Que Choisir (autres diagnostics)'
            : 'Référentiel marché ADEME / Que Choisir 2024 — refresh DB en attente'
        }
        dataStatus={status}
        periodLabel={periodLabel}
        axes={{ x: 'Région métropolitaine', y: 'Prix médian TTC (€)' }}
      />
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
    <Card variant="flat" padding="sm" className="flex flex-col gap-2.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/55 font-medium">
        {label}
      </p>
      <div className="flex items-baseline gap-1.5">
        <span className="font-serif italic text-[26px] text-ink leading-none">{median}</span>
        <span className="text-[12px] text-ink-mute">€ médian</span>
      </div>
      {/* Mini barre min-max */}
      <div className="relative h-1 bg-sage-alt rounded-full overflow-hidden">
        <div className="absolute h-full bg-navy/80 rounded-full left-0 w-full" />
      </div>
      <div className="flex justify-between font-mono text-[10px] text-ink-mute">
        <span>{min} €</span>
        <span>{max} €</span>
      </div>
    </Card>
  )
}
