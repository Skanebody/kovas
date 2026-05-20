import { Card } from '@/components/ui/card'
import type { CohortRetentionRow } from '@/lib/admin/growth-analytics'
import { cn } from '@/lib/utils'

export interface CohortRetentionTableProps {
  cohorts: CohortRetentionRow[]
}

const BUCKETS: Array<{ key: keyof CohortRetentionRow['retention']; label: string }> = [
  { key: 'w0', label: 'W0' },
  { key: 'w1', label: 'W1' },
  { key: 'w2', label: 'W2' },
  { key: 'w4', label: 'W4' },
  { key: 'w8', label: 'W8' },
]

function formatCohortMonth(ym: string): string {
  // YYYY-MM → MMM YYYY (FR)
  const [y, m] = ym.split('-')
  if (!y || !m) return ym
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }).replace('.', '')
}

/**
 * Cellule colorée selon le ratio de retention.
 *
 * Gradient sage (1) → vert clair (intermediate) → success (high) → ink/5 (0).
 */
function retentionCellStyle(ratio: number): { background: string; color: string } {
  if (ratio <= 0) {
    return { background: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.4)' }
  }
  // Interpolation entre vert très pâle (rgba(34,197,94,0.05)) et plein (rgba(34,197,94,0.55)).
  const alpha = 0.05 + Math.min(1, ratio) * 0.5
  const textColor = ratio > 0.5 ? '#0E3A20' : '#1A2F22'
  return { background: `rgba(34, 197, 94, ${alpha.toFixed(2)})`, color: textColor }
}

export function CohortRetentionTable({ cohorts }: CohortRetentionTableProps) {
  return (
    <Card variant="opaque" padding="default" className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Rétention par cohort
          </h2>
          <p className="text-[12px] text-ink-mute mt-0.5">
            Chaque cohort = signups du mois · % actifs à W0/W1/W2/W4/W8
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="text-ink-mute">
              <th className="text-left font-mono text-[10px] uppercase tracking-[0.16em] py-2 pr-3">
                Cohort
              </th>
              <th className="text-right font-mono text-[10px] uppercase tracking-[0.16em] py-2 pr-3">
                Taille
              </th>
              {BUCKETS.map((b) => (
                <th
                  key={b.key}
                  className="text-center font-mono text-[10px] uppercase tracking-[0.16em] py-2 px-2"
                >
                  {b.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cohorts.length === 0 ? (
              <tr>
                <td
                  colSpan={2 + BUCKETS.length}
                  className="text-center text-ink-mute py-6 text-[12px]"
                >
                  Aucune cohort sur la période.
                </td>
              </tr>
            ) : (
              cohorts.map((cohort) => (
                <tr key={cohort.cohortMonth} className="border-t border-rule/30">
                  <td className="py-2 pr-3 text-ink font-medium">
                    {formatCohortMonth(cohort.cohortMonth)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-[11px] text-ink-mute">
                    {cohort.size}
                  </td>
                  {BUCKETS.map((b) => {
                    const count = cohort.retention[b.key]
                    const ratio = cohort.size > 0 ? count / cohort.size : 0
                    const style = retentionCellStyle(ratio)
                    return (
                      <td key={b.key} className="px-1 py-1">
                        <div
                          className={cn(
                            'rounded-md text-center py-1.5 px-1 font-mono text-[11px] tabular-nums',
                          )}
                          style={style}
                          title={`${count}/${cohort.size}`}
                        >
                          {cohort.size > 0 ? `${(ratio * 100).toFixed(0)}%` : '—'}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
