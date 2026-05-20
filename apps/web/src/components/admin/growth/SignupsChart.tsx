'use client'

import { Card } from '@/components/ui/card'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface SignupsChartProps {
  data: Array<{ day: string; count: number }>
}

interface ChartTooltipPayloadItem {
  value?: number | string
  payload?: { day?: string; count?: number }
}

interface ChartTooltipProps {
  active?: boolean
  payload?: ChartTooltipPayloadItem[]
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const first = payload[0]
  if (!first) return null
  const day = first.payload?.day ?? ''
  const count = typeof first.value === 'number' ? first.value : 0
  return (
    <div className="rounded-md border border-rule/60 bg-paper/95 px-3 py-1.5 shadow-md">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">{day}</p>
      <p className="text-[13px] font-semibold text-ink">
        {count} signup{count > 1 ? 's' : ''}
      </p>
    </div>
  )
}

function shortDayLabel(day: string): string {
  // YYYY-MM-DD → DD/MM
  const parts = day.split('-')
  if (parts.length !== 3) return day
  return `${parts[2]}/${parts[1]}`
}

export function SignupsChart({ data }: SignupsChartProps) {
  const total = data.reduce((acc, point) => acc + point.count, 0)
  const max = data.reduce((acc, p) => Math.max(acc, p.count), 0)

  return (
    <Card variant="opaque" padding="default" className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Signups · 30 derniers jours
          </h2>
          <p className="text-[12px] text-ink-mute mt-0.5">
            {total} comptes créés · pic à {max}/jour
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          live
        </span>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis
              dataKey="day"
              tickFormatter={shortDayLabel}
              stroke="rgba(0,0,0,0.4)"
              fontSize={10}
              interval="preserveStartEnd"
              minTickGap={20}
            />
            <YAxis
              stroke="rgba(0,0,0,0.4)"
              fontSize={10}
              allowDecimals={false}
              tickMargin={4}
              width={32}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(0,0,0,0.08)' }} />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#172a35"
              strokeWidth={2}
              dot={{ r: 2, fill: '#172a35' }}
              activeDot={{ r: 4, fill: '#D4F542', stroke: '#172a35', strokeWidth: 1.5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
