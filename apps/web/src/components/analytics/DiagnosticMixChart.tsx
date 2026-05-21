'use client'

/**
 * <DiagnosticMixChart> — Recharts BarChart vertical : répartition par type.
 */

import { Card } from '@/components/ui/card'
import { COMMUNITY_DIAGNOSTIC_LABELS, type CommunityDiagnosticKind } from '@/lib/community/types'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

export interface DiagnosticMixEntry {
  kind: string
  count: number
}

interface Props {
  data: DiagnosticMixEntry[]
}

interface TooltipPayload {
  value?: number
  payload?: { kind: string }
}

function labelFor(kind: string): string {
  const map = COMMUNITY_DIAGNOSTIC_LABELS as Record<string, string>
  return map[kind as CommunityDiagnosticKind] ?? kind.toUpperCase()
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload || payload.length === 0) return null
  const first = payload[0]
  if (!first?.payload) return null
  return (
    <div className="rounded-md border border-rule bg-paper px-3 py-2 shadow-md text-[11px] tabular-nums">
      <p className="font-medium text-ink mb-0.5">{labelFor(first.payload.kind)}</p>
      <p className="font-mono text-ink-mute">{first.value} missions</p>
    </div>
  )
}

export function DiagnosticMixChart({ data }: Props) {
  return (
    <Card variant="flat" padding="default" className="space-y-4">
      <h3 className="font-sans font-semibold text-[15px] text-ink">Mix diagnostics</h3>

      {data.length === 0 ? (
        <p className="text-sm text-ink-mute py-8 text-center">Aucune donnée.</p>
      ) : (
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
              <CartesianGrid stroke="rgba(15,20,25,0.06)" vertical={false} />
              <XAxis
                dataKey="kind"
                tickFormatter={labelFor}
                stroke="#7E8AA4"
                fontSize={10}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#7E8AA4"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={32}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(15,20,25,0.04)' }} />
              <Bar dataKey="count" fill="#D4F542" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
