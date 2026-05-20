'use client'

/**
 * RevenueByPeriod — barres stacked mensuelles par plan, avec switcher période.
 *
 * V1 : switcher visuel uniquement (Jour / Semaine / Mois / Trimestre / Année).
 * Le data binding réel multi-période arrivera V2 — pour l'instant on aggrège
 * uniquement par mois ; les autres modes affichent les mêmes données avec une
 * note explicative.
 */

import { Card } from '@/components/ui/card'
import type { MrrHistoryPoint } from '@/lib/admin/finance-calculator'
import { useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatEur, planColor, planLabel, shortMonth } from './finance-format'

export interface RevenueByPeriodProps {
  history: MrrHistoryPoint[]
}

type Period = 'day' | 'week' | 'month' | 'quarter' | 'year'

const PERIODS: ReadonlyArray<{ id: Period; label: string }> = [
  { id: 'day', label: 'Jour' },
  { id: 'week', label: 'Sem.' },
  { id: 'month', label: 'Mois' },
  { id: 'quarter', label: 'Trim.' },
  { id: 'year', label: 'Année' },
]

interface ChartRow {
  monthLabel: string
  [planKey: string]: string | number
}

export function RevenueByPeriod({ history }: RevenueByPeriodProps) {
  const [period, setPeriod] = useState<Period>('month')

  const planIds = Array.from(new Set(history.flatMap((point) => Object.keys(point.byPlan))))

  const data: ChartRow[] = history.map((p) => {
    const row: ChartRow = { monthLabel: shortMonth(p.month) }
    for (const id of planIds) {
      row[id] = p.byPlan[id] ?? 0
    }
    return row
  })

  return (
    <Card variant="opaque" padding="default" className="col-span-full lg:col-span-2">
      <header className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            Revenue · par période
          </p>
          <h2 className="font-serif italic text-3xl text-ink mt-1">Détail.</h2>
        </div>
        <nav
          aria-label="Sélection période"
          className="inline-flex rounded-md bg-sage-alt p-0.5 text-[11px] font-mono uppercase tracking-wider"
        >
          {PERIODS.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => setPeriod(p.id)}
              className={
                period === p.id
                  ? 'rounded px-2.5 py-1.5 bg-paper text-ink shadow-sm'
                  : 'rounded px-2.5 py-1.5 text-ink-mute hover:text-ink'
              }
            >
              {p.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
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
              cursor={{ fill: 'rgba(212, 245, 66, 0.12)' }}
            />
            <Legend
              iconType="square"
              formatter={(value: string) => (
                <span style={{ color: '#5B7088', fontSize: 11 }}>{planLabel(value)}</span>
              )}
            />
            {planIds.map((id) => (
              <Bar key={id} dataKey={id} stackId="rev" fill={planColor(id)} radius={[0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {period !== 'month' && (
        <p className="mt-3 text-[11px] text-ink-faint">
          Vue {PERIODS.find((p) => p.id === period)?.label.toLowerCase()} — agrégation V2 (données
          mensuelles affichées).
        </p>
      )}
    </Card>
  )
}
