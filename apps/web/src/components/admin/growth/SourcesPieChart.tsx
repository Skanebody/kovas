'use client'

import { Card } from '@/components/ui/card'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

export interface SourcesPieChartProps {
  data: Array<{ source: string; count: number; percent: number }>
  isStub?: boolean
}

const COLORS = ['#172a35', '#D4F542', '#A6CDE1', '#F5C6A6', '#D5C9F5']

interface PiePayloadItem {
  payload?: { source?: string; count?: number; percent?: number }
}

interface PieTooltipProps {
  active?: boolean
  payload?: PiePayloadItem[]
}

function PieTooltip({ active, payload }: PieTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const first = payload[0]
  if (!first?.payload) return null
  const { source = '', count = 0, percent = 0 } = first.payload
  return (
    <div className="rounded-md border border-rule/60 bg-paper/95 px-3 py-1.5 shadow-md">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">{source}</p>
      <p className="text-[13px] font-semibold text-ink">
        {count} · {percent.toFixed(0)}%
      </p>
    </div>
  )
}

export function SourcesPieChart({ data, isStub }: SourcesPieChartProps) {
  return (
    <Card variant="opaque" padding="default" className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Sources d'acquisition
          </h2>
          <p className="text-[12px] text-ink-mute mt-0.5">
            {isStub ? 'Stub V1 · UTM tracking à venir V2' : 'Répartition des signups par canal'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="source"
                innerRadius={36}
                outerRadius={70}
                paddingAngle={2}
                stroke="rgba(255,255,255,0.6)"
                strokeWidth={1}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.source} fill={COLORS[index % COLORS.length] ?? '#172a35'} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="space-y-1.5" aria-label="Légende sources">
          {data.map((entry, index) => (
            <li key={entry.source} className="flex items-center gap-2 text-[12px] text-ink-mute">
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: COLORS[index % COLORS.length] ?? '#172a35' }}
                aria-hidden
              />
              <span className="flex-1 text-ink">{entry.source}</span>
              <span className="font-mono text-[11px] text-ink-faint">
                {entry.count} · {entry.percent.toFixed(0)}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      {isStub ? (
        <p className="mt-4 rounded-md border border-amber/40 bg-amber/5 px-3 py-2 text-[11px] text-ink-mute">
          <span className="font-semibold text-ink">TODO V2</span> · Ajouter colonnes{' '}
          <code className="font-mono text-[10px]">signup_source</code>,{' '}
          <code className="font-mono text-[10px]">signup_medium</code>,{' '}
          <code className="font-mono text-[10px]">signup_campaign</code> (UTM) sur{' '}
          <code className="font-mono text-[10px]">profiles</code>.
        </p>
      ) : null}
    </Card>
  )
}
