/**
 * PricingComparisonTable — table anonymisée des prix par user × diagnostic.
 *
 * Alerte visuelle (badge) si ≥ 20% écart vs moyenne (sous ou au-dessus).
 * Aucun user_id ni email exposé — uniquement un index anonyme (User #1...#N).
 */

import { Card } from '@/components/ui/card'
import type { PricingComparison } from '@/lib/admin/revenue-metrics'
import { cn } from '@/lib/utils'

export interface PricingComparisonTableProps {
  comparison: PricingComparison
}

function formatPriceEur(n: number | null): string {
  if (n === null) return '—'
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(n)
}

function deviationClass(price: number | null, avg: number): string {
  if (price === null || avg === 0) return 'text-ink-mute'
  const ratio = (price - avg) / avg
  if (ratio > 0.2) return 'text-warning font-medium'
  if (ratio < -0.2) return 'text-accent-red font-medium'
  return 'text-ink'
}

export function PricingComparisonTable({ comparison }: PricingComparisonTableProps) {
  const { diagnostics, averages, rows } = comparison

  return (
    <Card variant="opaque" padding="default">
      <header className="mb-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Comparaison tarifaire anonymisée
        </p>
        <h2 className="font-serif italic text-3xl text-ink mt-1">Prix HT par diagnostic.</h2>
        <p className="mt-1 text-xs text-ink-faint">
          Alertes : <span className="text-warning">+20%</span> ·{' '}
          <span className="text-accent-red">−20%</span> vs moyenne marché
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="text-sm text-ink-mute py-8 text-center">
          Aucune configuration tarifaire renseignée pour l'instant.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-rule/60">
                <th className="py-2.5 text-left font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                  User
                </th>
                {diagnostics.map((diag) => (
                  <th
                    key={diag}
                    className="py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute"
                  >
                    {diag}
                  </th>
                ))}
                <th className="py-2.5 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-ink-mute">
                  Outlier
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-rule/60 bg-paper/30">
                <td className="py-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
                  Moyenne
                </td>
                {diagnostics.map((diag) => (
                  <td key={diag} className="py-3 text-right font-mono text-ink font-medium">
                    {formatPriceEur(averages[diag] ?? null)}
                  </td>
                ))}
                <td className="py-3 text-right" />
              </tr>
              {rows.map((row) => (
                <tr key={`user-${row.anon}`} className="border-b border-rule/30">
                  <td className="py-3 text-ink">User #{row.anon}</td>
                  {diagnostics.map((diag) => (
                    <td
                      key={diag}
                      className={cn(
                        'py-3 text-right font-mono',
                        deviationClass(row.prices[diag] ?? null, averages[diag] ?? 0),
                      )}
                    >
                      {formatPriceEur(row.prices[diag] ?? null)}
                    </td>
                  ))}
                  <td className="py-3 text-right">
                    {row.outlier ? (
                      <span className="inline-flex items-center rounded-full bg-warning/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-warning">
                        écart
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] text-ink-faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
