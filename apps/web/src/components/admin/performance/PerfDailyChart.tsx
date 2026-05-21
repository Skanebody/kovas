'use client'

/**
 * Line chart p50/p95 + bar count par jour sur 7 jours.
 * Dual axis : latence (gauche, ms) + count (droite).
 */

import { Card } from '@/components/ui/card'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface Point {
  date: string
  p50ms: number
  p95ms: number
  count: number
  errorCount: number
}

interface Props {
  data: Point[]
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' })
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

interface TooltipPayloadItem {
  dataKey?: string
  name?: string
  value?: number
  color?: string
  payload?: Point
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayloadItem[]
}) {
  if (!active || !payload || payload.length === 0) return null
  const first = payload[0]
  if (!first?.payload) return null
  return (
    <div className="rounded-md border border-rule/60 bg-paper px-3 py-2 shadow-md text-[11px] tabular-nums">
      <p className="font-medium text-ink mb-1">{formatShortDate(first.payload.date)}</p>
      <p className="font-mono text-ink-mute">p50 : {formatMs(first.payload.p50ms)}</p>
      <p className="font-mono text-ink">p95 : {formatMs(first.payload.p95ms)}</p>
      <p className="font-mono text-ink-mute">Calls : {first.payload.count}</p>
      {first.payload.errorCount > 0 ? (
        <p className="font-mono text-danger">Erreurs : {first.payload.errorCount}</p>
      ) : null}
    </div>
  )
}

export function PerfDailyChart({ data }: Props) {
  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">
          Évolution 7 jours
        </h2>
        <div className="flex gap-3 text-[10px] font-mono uppercase tracking-[0.14em]">
          <span className="flex items-center gap-1.5 text-ink-mute">
            <span className="size-2 rounded-full bg-[#5B7088]" /> p50
          </span>
          <span className="flex items-center gap-1.5 text-ink-mute">
            <span className="size-2 rounded-full bg-[#163144]" /> p95
          </span>
          <span className="flex items-center gap-1.5 text-ink-mute">
            <span className="size-2 rounded-sm bg-[#D4F542]" /> Calls
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-ink-mute py-8 text-center">Aucune donnée sur 7 jours.</p>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="rgba(15,20,25,0.06)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                stroke="#7E8AA4"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="ms"
                stroke="#7E8AA4"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={50}
                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}`)}
              />
              <YAxis
                yAxisId="count"
                orientation="right"
                stroke="#7E8AA4"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={36}
              />
              <Tooltip content={<ChartTooltip />} />
              <Bar
                yAxisId="count"
                dataKey="count"
                name="Calls"
                fill="#D4F542"
                fillOpacity={0.5}
                radius={[3, 3, 0, 0]}
              />
              <Line
                yAxisId="ms"
                type="monotone"
                dataKey="p50ms"
                name="p50"
                stroke="#5B7088"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="ms"
                type="monotone"
                dataKey="p95ms"
                name="p95"
                stroke="#163144"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
