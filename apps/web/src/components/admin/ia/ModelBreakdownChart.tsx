'use client'

/**
 * Répartition des coûts IA par modèle (ce mois).
 * Pie chart Recharts + légende couleur côté droit avec valeurs absolues.
 */

import { Card } from '@/components/ui/card'
import type { ModelBreakdownEntry } from '@/lib/admin/ia-analytics'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

interface ModelBreakdownChartProps {
  breakdown: ModelBreakdownEntry[]
}

// Palette dérivée du design system v5 (chartreuse signature + sémantiques + navy)
// Hex directs : Recharts attend une string CSS color, on évite les var() qui
// posent souvent souci dans les SVG calculés en runtime.
const PALETTE = [
  '#D4F542', // chartreuse (signature)
  '#3B82F6', // info / blue
  '#D97706', // amber
  '#10B981', // success / green
  '#F59E0B', // warning / orange
  '#163144', // navy
  '#EF4444', // danger / red
  '#5B7088', // ink-mute
]

function colorFor(idx: number): string {
  return PALETTE[idx % PALETTE.length] ?? '#8A99AE'
}

function formatEur(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Tooltip Recharts payload : array de { name, value, payload } */
interface TooltipPayloadItem {
  name?: string
  value?: number
  payload?: { model: string; costEur: number; percentOfTotal: number }
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
}) {
  if (!active || !payload || payload.length === 0) return null
  const item = payload[0]
  if (!item?.payload) return null
  return (
    <div className="rounded-md border border-rule/60 bg-paper px-3 py-2 shadow-md text-[12px]">
      <p className="font-medium text-ink">{item.payload.model}</p>
      <p className="font-mono text-ink-mute">
        {formatEur(item.payload.costEur)} · {item.payload.percentOfTotal.toFixed(1)}%
      </p>
    </div>
  )
}

export function ModelBreakdownChart({ breakdown }: ModelBreakdownChartProps) {
  const total = breakdown.reduce((s, b) => s + b.costEur, 0)

  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">
          Répartition par modèle
        </h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          Ce mois · {formatEur(total)}
        </span>
      </div>

      {breakdown.length === 0 ? (
        <p className="text-sm text-ink-mute py-4">Aucune donnée IA ce mois.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={breakdown}
                  dataKey="costEur"
                  nameKey="model"
                  innerRadius={45}
                  outerRadius={85}
                  paddingAngle={2}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                >
                  {breakdown.map((entry, idx) => (
                    <Cell key={entry.model} fill={colorFor(idx)} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <ul className="space-y-2 text-[12px]" aria-label="Légende répartition par modèle">
            {breakdown.map((entry, idx) => (
              <li key={entry.model} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="size-2.5 rounded-full shrink-0"
                    style={{ background: colorFor(idx) }}
                    aria-hidden
                  />
                  <span className="text-ink truncate font-mono text-[11px]">{entry.model}</span>
                </span>
                <span className="font-mono text-ink-mute shrink-0">
                  {formatEur(entry.costEur)} · {entry.percentOfTotal.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
