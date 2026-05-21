'use client'

/**
 * Line chart Recharts — delivered / bounced / complained sur 30 jours.
 */

import { Card } from '@/components/ui/card'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface DailyPoint {
  date: string
  delivered: number
  bounced: number
  complained: number
}

interface Props {
  data: DailyPoint[]
}

interface TooltipPayloadItem {
  dataKey?: string
  name?: string
  value?: number
  color?: string
  payload?: DailyPoint
}

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
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
      {payload.map((p) => (
        <p key={p.dataKey} className="font-mono text-ink-mute" style={{ color: p.color }}>
          {p.name} : {p.value}
        </p>
      ))}
    </div>
  )
}

export function EmailDailyChart({ data }: Props) {
  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">
          Évolution quotidienne · 30j
        </h2>
        <div className="flex gap-3 text-[10px] font-mono uppercase tracking-[0.14em]">
          <span className="flex items-center gap-1.5 text-ink-mute">
            <span className="size-2 rounded-full bg-[#10B981]" /> Delivered
          </span>
          <span className="flex items-center gap-1.5 text-ink-mute">
            <span className="size-2 rounded-full bg-[#D97706]" /> Bounced
          </span>
          <span className="flex items-center gap-1.5 text-ink-mute">
            <span className="size-2 rounded-full bg-[#DC2626]" /> Plaintes
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-ink-mute py-8 text-center">Aucune donnée sur 30 jours.</p>
      ) : (
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="rgba(15,20,25,0.06)" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatShortDate}
                stroke="#7E8AA4"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                stroke="#7E8AA4"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={40}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="delivered"
                name="Delivered"
                stroke="#10B981"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="bounced"
                name="Bounced"
                stroke="#D97706"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="complained"
                name="Plaintes"
                stroke="#DC2626"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
