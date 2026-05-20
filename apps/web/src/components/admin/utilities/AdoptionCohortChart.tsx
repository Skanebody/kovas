'use client'

/**
 * Adoption des 5 outils Utilities par cohorte (6 derniers mois).
 * Recharts LineChart 5 lignes.
 */

import { Card } from '@/components/ui/card'
import type { UtilityCohortRow } from '@/lib/admin/utilities-metrics'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface AdoptionCohortChartProps {
  data: UtilityCohortRow[]
}

const LINE_KEYS = [
  { key: 'diagnosticReq', label: 'Diagnostics requis', color: '#D4F542' },
  { key: 'validityChecker', label: 'Vérif. validité', color: '#3B82F6' },
  { key: 'surfaceCalc', label: 'Calcul surface', color: '#D97706' },
  { key: 'templates', label: 'Templates pièces', color: '#10B981' },
  { key: 'checklist', label: 'Checklist départ', color: '#163144' },
] as const

function shortMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-')
  if (!y || !m) return monthKey
  const date = new Date(Number.parseInt(y, 10), Number.parseInt(m, 10) - 1, 1)
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }).replace('.', '')
}

function labelFor(key: string): string {
  return LINE_KEYS.find((k) => k.key === key)?.label ?? key
}

interface CohortTooltipPayloadItem {
  dataKey?: string | number
  value?: number | string
  color?: string
}

interface CohortTooltipProps {
  active?: boolean
  payload?: CohortTooltipPayloadItem[]
  label?: string | number
}

function ChartTooltip({ active, payload, label }: CohortTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-md border border-rule/60 bg-paper px-3 py-2 shadow-md text-[12px]">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute mb-1.5">
        {typeof label === 'string' ? label : String(label ?? '')}
      </p>
      <ul className="space-y-1">
        {payload.map((p) => (
          <li key={String(p.dataKey)} className="flex items-center gap-2">
            <span
              className="size-2 rounded-full"
              style={{ background: p.color ?? '#5B7088' }}
              aria-hidden
            />
            <span className="text-ink-mute">{labelFor(String(p.dataKey))}</span>
            <span className="font-mono text-ink ml-auto">{p.value ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function AdoptionCohortChart({ data }: AdoptionCohortChartProps) {
  const chartData = data.map((row) => ({
    ...row,
    monthLabel: shortMonth(row.cohortMonth),
  }))

  return (
    <Card variant="opaque" padding="default">
      <header className="mb-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Adoption par cohorte · 6 mois
        </p>
        <h3 className="text-[15px] font-semibold tracking-tight text-ink mt-1">
          Usage cumulé par outil
        </h3>
      </header>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis
              dataKey="monthLabel"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#5B7088', fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#5B7088', fontSize: 11 }}
              allowDecimals={false}
              width={36}
            />
            <Tooltip content={<ChartTooltip />} />
            <Legend
              iconType="circle"
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value: string) => (
                <span style={{ color: '#5B7088' }}>{labelFor(value)}</span>
              )}
            />
            {LINE_KEYS.map((k) => (
              <Line
                key={k.key}
                type="monotone"
                dataKey={k.key}
                stroke={k.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
