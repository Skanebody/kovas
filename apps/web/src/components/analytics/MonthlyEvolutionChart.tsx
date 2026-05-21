'use client'

/**
 * <MonthlyEvolutionChart> — Recharts LineChart 12 derniers mois (CA + missions).
 */

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

export interface EvolutionPoint {
  /** YYYY-MM (label affiché en "MMM YY"). */
  period: string
  revenueHtCents: number
  missions: number
}

interface Props {
  data: EvolutionPoint[]
}

interface TooltipPayload {
  dataKey?: string
  name?: string
  value?: number
  color?: string
  payload?: EvolutionPoint
}

function formatShortMonth(iso: string): string {
  const [year, month] = iso.split('-')
  if (!year || !month) return iso
  const d = new Date(Number(year), Number(month) - 1, 1)
  return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

function formatRevenueEur(cents: number): string {
  return `${Math.round(cents / 100).toLocaleString('fr-FR')} €`
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: TooltipPayload[]
}) {
  if (!active || !payload || payload.length === 0) return null
  const first = payload[0]
  if (!first?.payload) return null
  return (
    <div className="rounded-md border border-rule bg-paper px-3 py-2 shadow-md text-[11px] tabular-nums">
      <p className="font-medium text-ink mb-1">{formatShortMonth(first.payload.period)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="font-mono text-ink-mute" style={{ color: p.color }}>
          {p.name} :{' '}
          {p.dataKey === 'revenueHtCents' && typeof p.value === 'number'
            ? formatRevenueEur(p.value)
            : p.value}
        </p>
      ))}
    </div>
  )
}

export function MonthlyEvolutionChart({ data }: Props) {
  return (
    <Card variant="flat" padding="default" className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-sans font-semibold text-[15px] text-ink">Évolution mensuelle</h3>
        <div className="flex gap-3 text-[10px] font-mono uppercase tracking-[0.12em]">
          <span className="flex items-center gap-1.5 text-ink-mute">
            <span className="size-2 rounded-full bg-[#0F1419]" /> CA HT
          </span>
          <span className="flex items-center gap-1.5 text-ink-mute">
            <span className="size-2 rounded-full bg-chartreuse" /> Missions
          </span>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-ink-mute py-8 text-center">Aucune donnée.</p>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="rgba(15,20,25,0.06)" vertical={false} />
              <XAxis
                dataKey="period"
                tickFormatter={formatShortMonth}
                stroke="#7E8AA4"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                yAxisId="left"
                stroke="#7E8AA4"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={50}
                tickFormatter={(v: number) => `${Math.round(v / 100_00)}k`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#7E8AA4"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={32}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="revenueHtCents"
                name="CA HT"
                stroke="#0F1419"
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="missions"
                name="Missions"
                stroke="#D4F542"
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
