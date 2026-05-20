'use client'

import { Card } from '@/components/ui/card'
import type { ActivationMonthRow } from '@/lib/admin/growth-analytics'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface ActivationStatsProps {
  rows: ActivationMonthRow[]
}

interface ChartPayloadItem {
  payload?: ActivationMonthRow
  value?: number | string
}

interface ActivationTooltipProps {
  active?: boolean
  payload?: ChartPayloadItem[]
}

function ActivationTooltip({ active, payload }: ActivationTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const first = payload[0]
  if (!first?.payload) return null
  const { month, signups, activated, rate } = first.payload
  return (
    <div className="rounded-md border border-rule/60 bg-paper/95 px-3 py-1.5 shadow-md">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">{month}</p>
      <p className="text-[13px] font-semibold text-ink">{(rate * 100).toFixed(1)}%</p>
      <p className="text-[11px] text-ink-mute">
        {activated} / {signups} signups
      </p>
    </div>
  )
}

function formatMonthShort(ym: string): string {
  const [y, m] = ym.split('-')
  if (!y || !m) return ym
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }).replace('.', '')
}

export function ActivationStats({ rows }: ActivationStatsProps) {
  const data = rows.map((row) => ({
    ...row,
    monthLabel: formatMonthShort(row.month),
    ratePct: Number((row.rate * 100).toFixed(1)),
  }))
  const latest = rows[rows.length - 1]
  const latestRate = latest ? latest.rate * 100 : 0

  return (
    <Card variant="opaque" padding="default" className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Taux d'activation · 6 derniers mois
          </h2>
          <p className="text-[12px] text-ink-mute mt-0.5">
            Dernier mois : <strong className="text-ink">{latestRate.toFixed(1)}%</strong> · cible ≥
            55%
          </p>
        </div>
      </div>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis dataKey="monthLabel" stroke="rgba(0,0,0,0.4)" fontSize={10} />
            <YAxis
              stroke="rgba(0,0,0,0.4)"
              fontSize={10}
              tickFormatter={(v) => `${v}%`}
              domain={[0, 100]}
              width={36}
            />
            <Tooltip content={<ActivationTooltip />} cursor={{ stroke: 'rgba(0,0,0,0.08)' }} />
            <Line
              type="monotone"
              dataKey="ratePct"
              stroke="#172a35"
              strokeWidth={2}
              dot={{ r: 3, fill: '#D4F542', stroke: '#172a35', strokeWidth: 1.2 }}
              activeDot={{ r: 5, fill: '#D4F542', stroke: '#172a35', strokeWidth: 1.5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
