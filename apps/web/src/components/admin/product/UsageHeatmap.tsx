/**
 * Heatmap d'usage 7 jours × 24 heures (création de dossiers).
 *
 * Server component pur — grille CSS, colormap chartreuse interpolée sur la
 * valeur max. Convention FR (lundi en première colonne).
 */

import { Card } from '@/components/ui/card'
import type { UsageHeatmapCell } from '@/lib/admin/product-analytics'

interface UsageHeatmapProps {
  cells: UsageHeatmapCell[]
  days: number
}

const DAY_LABELS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const HOURS = Array.from({ length: 24 }, (_, h) => h)
const LEGEND_STEPS = [
  { id: 'min', value: 0 },
  { id: 'q1', value: 0.25 },
  { id: 'q2', value: 0.5 },
  { id: 'q3', value: 0.75 },
  { id: 'max', value: 1 },
]

/**
 * Interpole entre l'opacité 0 et 1 sur chartreuse #D4F542.
 * On garde une opacité min 0.05 quand count=0 pour matérialiser la grille.
 */
function cellBg(count: number, max: number): string {
  if (max === 0) return 'rgba(212, 245, 66, 0.05)'
  const ratio = count === 0 ? 0 : Math.min(1, 0.15 + (count / max) * 0.85)
  return `rgba(212, 245, 66, ${ratio.toFixed(3)})`
}

export function UsageHeatmap({ cells, days }: UsageHeatmapProps) {
  const max = cells.reduce((acc, c) => (c.count > acc ? c.count : acc), 0)
  const total = cells.reduce((acc, c) => acc + c.count, 0)

  // Bucketize en grille [dow][hour].
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const cell of cells) {
    if (cell.dayOfWeek >= 0 && cell.dayOfWeek < 7 && cell.hour >= 0 && cell.hour < 24) {
      const row = grid[cell.dayOfWeek]
      if (row) row[cell.hour] = cell.count
    }
  }

  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Heatmap d&apos;usage · jour × heure
          </h2>
          <p className="text-[12px] text-ink-mute mt-0.5">
            Création de dossiers sur les {days} derniers jours · {total} dossiers
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          Europe/Paris
        </span>
      </div>

      {total === 0 ? (
        <p className="text-sm text-ink-mute py-4">Aucune création de dossier sur la période.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-[2px]" aria-label="Heatmap d'usage">
            <thead>
              <tr>
                <th className="w-8" aria-hidden />
                {HOURS.map((h) => (
                  <th
                    key={`h-${h}`}
                    className="w-5 font-mono text-[9px] text-ink-faint font-normal align-bottom pb-1"
                  >
                    {h % 3 === 0 ? `${h}h` : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAY_LABELS_SHORT.map((label, d) => (
                <tr key={label}>
                  <td className="font-mono text-[10px] text-ink-mute pr-2 text-right">{label}</td>
                  {HOURS.map((h) => {
                    const count = grid[d]?.[h] ?? 0
                    return (
                      <td
                        key={`${label}-${h}`}
                        className="w-5 h-5 rounded-sm border border-rule/30"
                        style={{ backgroundColor: cellBg(count, max) }}
                        title={`${label} ${h}h · ${count} dossier${count > 1 ? 's' : ''}`}
                      />
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 mt-4">
        <span className="font-mono text-[10px] text-ink-faint">Moins</span>
        <div className="flex gap-[2px]">
          {LEGEND_STEPS.map((step) => (
            <span
              key={step.id}
              className="size-3 rounded-sm border border-rule/30"
              style={{ backgroundColor: `rgba(212, 245, 66, ${Math.max(0.05, step.value)})` }}
              aria-hidden
            />
          ))}
        </div>
        <span className="font-mono text-[10px] text-ink-faint">Plus</span>
      </div>
    </Card>
  )
}
