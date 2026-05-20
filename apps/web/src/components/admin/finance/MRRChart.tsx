'use client'

/**
 * MRRChart — ligne MRR total + stack par plan sur 12 mois.
 *
 * Recharts AreaChart (stacked) navy/chartreuse v5.
 */

import { Card } from '@/components/ui/card'
import type { MrrHistoryPoint } from '@/lib/admin/finance-calculator'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatEur, planColor, planLabel, shortMonth } from './finance-format'

export interface MRRChartProps {
  history: MrrHistoryPoint[]
}

interface ChartRow {
  month: string
  monthLabel: string
  total: number
  // Dynamiques par plan
  [planKey: string]: string | number
}

export function MRRChart({ history }: MRRChartProps) {
  const planIds = Array.from(new Set(history.flatMap((point) => Object.keys(point.byPlan))))

  const data: ChartRow[] = history.map((p) => {
    const row: ChartRow = {
      month: p.month,
      monthLabel: shortMonth(p.month),
      total: p.mrr,
    }
    for (const id of planIds) {
      row[id] = p.byPlan[id] ?? 0
    }
    return row
  })

  return (
    <Card variant="opaque" padding="default" className="col-span-full lg:col-span-2">
      <header className="flex items-baseline justify-between gap-4 mb-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            MRR · 12 derniers mois
          </p>
          <h2 className="font-serif italic text-3xl text-ink mt-1">Croissance.</h2>
        </div>
        <p className="text-xs text-ink-faint">stack par plan</p>
      </header>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
            <defs>
              {planIds.map((id) => (
                <linearGradient key={id} id={`gradient-${id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={planColor(id)} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={planColor(id)} stopOpacity={0.05} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E7E2D2" vertical={false} />
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
              tickFormatter={(v: number) => `${Math.round(v)}€`}
              width={56}
            />
            <Tooltip
              contentStyle={{
                background: '#FFFFFF',
                border: '1px solid #E7E2D2',
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(value, name) => [
                typeof value === 'number' ? formatEur(value) : String(value ?? '—'),
                planLabel(String(name ?? '')),
              ]}
              labelStyle={{ color: '#163144', fontWeight: 600 }}
            />
            <Legend
              iconType="circle"
              formatter={(value: string) => (
                <span style={{ color: '#5B7088', fontSize: 11 }}>{planLabel(value)}</span>
              )}
            />
            {planIds.map((id) => (
              <Area
                key={id}
                type="monotone"
                dataKey={id}
                stackId="1"
                stroke={planColor(id)}
                strokeWidth={2}
                fill={`url(#gradient-${id})`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
