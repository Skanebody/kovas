'use client'

/**
 * Donut Capture vs Classic — répartition des modes terrain.
 */

import { Card } from '@/components/ui/card'
import type { CaptureVsClassicSplit as Split } from '@/lib/admin/product-analytics'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'

interface DonutSlice {
  name: 'Capture' | 'Classic'
  value: number
  pct: number
  color: string
}

interface TooltipPayloadItem {
  payload?: DonutSlice
}

interface TooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
}

function DonutTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  const first = payload[0]
  if (!first?.payload) return null
  const { name, value, pct } = first.payload
  return (
    <div className="rounded-md border border-rule/60 bg-paper/95 px-3 py-1.5 shadow-md">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">{name}</p>
      <p className="text-[13px] font-semibold text-ink">
        {value} · {pct.toFixed(1)}%
      </p>
    </div>
  )
}

export interface CaptureVsClassicSplitProps {
  data: Split
}

export function CaptureVsClassicSplit({ data }: CaptureVsClassicSplitProps) {
  const total = data.capture + data.classic
  const captureSlice: DonutSlice = {
    name: 'Capture',
    value: data.capture,
    pct: total > 0 ? (data.capture / total) * 100 : 0,
    color: '#D4F542',
  }
  const classicSlice: DonutSlice = {
    name: 'Classic',
    value: data.classic,
    pct: total > 0 ? (data.classic / total) * 100 : 0,
    color: '#163144',
  }
  const slices: DonutSlice[] = [captureSlice, classicSlice]

  return (
    <Card variant="opaque" padding="default" className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Mode terrain · Capture vs Classic
          </h2>
          <p className="text-[12px] text-ink-mute mt-0.5">
            Préférence stockée dans user_preferences (fallback : usage photos Vision).
          </p>
        </div>
      </div>

      {total === 0 ? (
        <p className="text-sm text-ink-mute py-4">Aucune préférence enregistrée.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div className="h-44 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={42}
                  outerRadius={76}
                  paddingAngle={2}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                >
                  {slices.map((s) => (
                    <Cell key={s.name} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip content={<DonutTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="text-center">
                <p className="font-serif italic text-2xl text-ink leading-none">
                  {data.capturePct.toFixed(0)}%
                </p>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ink-mute mt-1">
                  Capture
                </p>
              </div>
            </div>
          </div>

          <ul className="space-y-1.5" aria-label="Légende Capture vs Classic">
            {slices.map((s) => (
              <li key={s.name} className="flex items-center gap-2 text-[12px] text-ink-mute">
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
                <span className="flex-1 text-ink">{s.name}</span>
                <span className="font-mono text-[11px] text-ink-faint">
                  {s.value} · {s.pct.toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
