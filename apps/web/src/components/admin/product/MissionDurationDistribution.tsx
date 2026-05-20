'use client'

/**
 * Distribution des durées de mission (sessions terrain) en 4 buckets.
 */

import { Card } from '@/components/ui/card'
import type { MissionDurationBucket } from '@/lib/admin/product-analytics'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

interface ChartTooltipPayloadItem {
  value?: number | string
  payload?: { bucket?: string; count?: number }
}

interface ChartTooltipProps {
  active?: boolean
  payload?: ChartTooltipPayloadItem[]
}

function ChartTooltip({ active, payload }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const first = payload[0]
  if (!first) return null
  const bucket = first.payload?.bucket ?? ''
  const count = typeof first.value === 'number' ? first.value : 0
  return (
    <div className="rounded-md border border-rule/60 bg-paper/95 px-3 py-1.5 shadow-md">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">{bucket}</p>
      <p className="text-[13px] font-semibold text-ink">
        {count} session{count > 1 ? 's' : ''}
      </p>
    </div>
  )
}

export interface MissionDurationDistributionProps {
  buckets: MissionDurationBucket[]
}

export function MissionDurationDistribution({ buckets }: MissionDurationDistributionProps) {
  const total = buckets.reduce((acc, b) => acc + b.count, 0)
  const median = (() => {
    if (total === 0) return '—'
    let cum = 0
    for (const b of buckets) {
      cum += b.count
      if (cum >= total / 2) return b.bucket
    }
    return buckets[buckets.length - 1]?.bucket ?? '—'
  })()

  return (
    <Card variant="opaque" padding="default" className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Durée des missions terrain
          </h2>
          <p className="text-[12px] text-ink-mute mt-0.5">
            {total} session{total > 1 ? 's' : ''} mesurée{total > 1 ? 's' : ''} · médiane {median}
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          mission_sessions
        </span>
      </div>

      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={buckets} margin={{ top: 8, right: 8, bottom: 8, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
            <XAxis
              dataKey="bucket"
              stroke="rgba(0,0,0,0.4)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="rgba(0,0,0,0.4)"
              fontSize={10}
              allowDecimals={false}
              tickMargin={4}
              width={32}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(212, 245, 66, 0.12)' }} />
            <Bar dataKey="count" fill="#D4F542" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
