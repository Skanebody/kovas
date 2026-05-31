'use client'

/**
 * ProjectionsChart — 3 lignes scenarios (pessimist / median / optimist) sur 6 mois.
 */

import { Card } from '@/components/ui/card'
import type { Projections } from '@/lib/admin/finance-calculator'
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
import { formatEur, shortMonth } from './finance-format'

export interface ProjectionsChartProps {
  projections: Projections
}

interface ChartRow {
  monthLabel: string
  pessimist: number
  median: number
  optimist: number
}

export function ProjectionsChart({ projections }: ProjectionsChartProps) {
  // Les 3 arrays sont alignés par index → on prend median comme référence longueur.
  const data: ChartRow[] = projections.median.map((m, i) => ({
    monthLabel: shortMonth(m.month),
    pessimist: Math.round(projections.pessimist[i]?.mrr ?? 0),
    median: Math.round(m.mrr),
    optimist: Math.round(projections.optimist[i]?.mrr ?? 0),
  }))

  return (
    <Card variant="opaque" padding="default" className="col-span-full lg:col-span-2">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            Projections · 6 mois à venir
          </p>
          <h2 className="font-serif italic text-3xl text-ink mt-1">Trajectoires.</h2>
        </div>
        <p className="text-xs text-ink-faint">pessimiste −20% · médian · optimiste +20%</p>
      </header>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
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
              formatter={(value) =>
                typeof value === 'number' ? formatEur(value) : String(value ?? '—')
              }
              labelStyle={{ color: '#163144', fontWeight: 600 }}
            />
            <Legend
              iconType="line"
              formatter={(value: string) => {
                const label =
                  value === 'pessimist'
                    ? 'Pessimiste'
                    : value === 'optimist'
                      ? 'Optimiste'
                      : 'Médian'
                return <span style={{ color: '#5B7088', fontSize: 11 }}>{label}</span>
              }}
            />
            <Line
              type="monotone"
              dataKey="pessimist"
              stroke="#5B7088"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="median"
              stroke="#D4F542"
              strokeWidth={3}
              dot={{ r: 3, fill: '#A3C920', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="optimist"
              stroke="#163144"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 text-[11px] text-ink-faint">
        Modèle linéaire V1 · base croissance moyenne 6 derniers mois. Régression non-linéaire V2.
      </p>
    </Card>
  )
}
