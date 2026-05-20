'use client'

/**
 * MarginsChart — ligne marge brute % vs barres CA absolu (dual axis).
 */

import { Card } from '@/components/ui/card'
import type { MarginPoint } from '@/lib/admin/finance-calculator'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatEur, formatPct, shortMonth } from './finance-format'

export interface MarginsChartProps {
  margins: MarginPoint[]
}

interface ChartRow {
  monthLabel: string
  revenue: number
  marginPct: number
}

export function MarginsChart({ margins }: MarginsChartProps) {
  const data: ChartRow[] = margins.map((m) => ({
    monthLabel: shortMonth(m.month),
    revenue: m.revenue,
    marginPct: Number(m.marginPct.toFixed(1)),
  }))

  return (
    <Card variant="opaque" padding="default">
      <header className="mb-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
          Marges · brutes vs CA
        </p>
        <h2 className="font-serif italic text-3xl text-ink mt-1">Rentabilité.</h2>
      </header>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E7E2D2" vertical={false} />
            <XAxis
              dataKey="monthLabel"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#5B7088', fontSize: 11 }}
            />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#5B7088', fontSize: 11 }}
              tickFormatter={(v: number) => `${Math.round(v)}€`}
              width={56}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#A3C920', fontSize: 11 }}
              tickFormatter={(v: number) => `${Math.round(v)}%`}
              width={40}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                background: '#FFFFFF',
                border: '1px solid #E7E2D2',
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(value, name) => {
                const num = typeof value === 'number' ? value : 0
                if (name === 'marginPct') return [formatPct(num, 1), 'Marge brute']
                return [formatEur(num), 'CA']
              }}
              labelStyle={{ color: '#163144', fontWeight: 600 }}
            />
            <Legend
              iconType="circle"
              formatter={(value: string) => (
                <span style={{ color: '#5B7088', fontSize: 11 }}>
                  {value === 'marginPct' ? 'Marge %' : 'CA'}
                </span>
              )}
            />
            <Bar
              yAxisId="left"
              dataKey="revenue"
              fill="#163144"
              fillOpacity={0.18}
              barSize={20}
              radius={[6, 6, 0, 0]}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="marginPct"
              stroke="#D4F542"
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#A3C920', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
