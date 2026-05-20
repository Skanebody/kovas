'use client'

/**
 * DurationAccuracyChart — Recharts LineChart 30j (diff_min avg jour).
 *
 * diff_min = actual_duration_min - estimated_duration_min
 *   - négatif : on a sur-estimé (mission terminée plus vite)
 *   - positif : on a sous-estimé (mission a débordé)
 *
 * Couleur navy v5 + référence axe 0 chartreuse.
 */

import { Card } from '@/components/ui/card'
import type { DurationAccuracyPoint } from '@/lib/admin/scheduling-metrics'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export interface DurationAccuracyChartProps {
  series: DurationAccuracyPoint[]
}

interface ChartRow {
  date: string
  dateLabel: string
  avgDiffMin: number
  sampleSize: number
}

function shortDay(ymd: string): string {
  const [y, m, d] = ymd.split('-')
  if (!y || !m || !d) return ymd
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }).replace('.', '')
}

export function DurationAccuracyChart({ series }: DurationAccuracyChartProps) {
  const data: ChartRow[] = series.map((p) => ({
    date: p.date,
    dateLabel: shortDay(p.date),
    avgDiffMin: p.avgDiffMin,
    sampleSize: p.sampleSize,
  }))

  return (
    <Card variant="opaque" padding="default">
      <header className="flex items-baseline justify-between gap-4 mb-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
            Précision estimations · 30 jours
          </p>
          <h2 className="font-serif italic text-3xl text-ink mt-1">Drift quotidien.</h2>
        </div>
        <p className="text-xs text-ink-faint">diff actuel − estimé (min)</p>
      </header>

      <div className="h-64 w-full">
        {data.length === 0 ? (
          <p className="text-sm text-ink-mute py-12 text-center">
            Aucune mission historisée sur la fenêtre.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E7E2D2" vertical={false} />
              <XAxis
                dataKey="dateLabel"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#5B7088', fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#5B7088', fontSize: 11 }}
                tickFormatter={(v: number) => `${Math.round(v)}min`}
                width={56}
              />
              <ReferenceLine y={0} stroke="#D4F542" strokeWidth={2} strokeDasharray="2 2" />
              <Tooltip
                contentStyle={{
                  background: '#FFFFFF',
                  border: '1px solid #E7E2D2',
                  borderRadius: 12,
                  fontSize: 12,
                }}
                formatter={(value, name) => {
                  if (name === 'avgDiffMin') {
                    return [
                      `${typeof value === 'number' ? value.toFixed(1) : value} min`,
                      'Écart moyen',
                    ]
                  }
                  return [String(value), 'Missions']
                }}
                labelStyle={{ color: '#163144', fontWeight: 600 }}
              />
              <Line
                type="monotone"
                dataKey="avgDiffMin"
                stroke="#163144"
                strokeWidth={2}
                dot={{ r: 3, fill: '#163144' }}
                activeDot={{ r: 5, fill: '#D4F542', stroke: '#163144', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
