/**
 * Cache hit rate (prompt caching Anthropic).
 * Big number 30j + comparaison 7j avec indicateur de tendance.
 *
 * Cf. CLAUDE.md §6 — prompt caching 1h TTL agressif sur Claude Haiku.
 */

import { Card } from '@/components/ui/card'
import type { CacheHitRateResult } from '@/lib/admin/ia-analytics'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

interface CacheHitRateProps {
  data: CacheHitRateResult
}

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`
}

const TREND_LABELS = {
  up: { label: 'En hausse', color: 'text-success', Icon: ArrowUpRight },
  down: { label: 'En baisse', color: 'text-accent-red', Icon: ArrowDownRight },
  stable: { label: 'Stable', color: 'text-ink-mute', Icon: Minus },
} as const

export function CacheHitRate({ data }: CacheHitRateProps) {
  const trend = TREND_LABELS[data.trend]
  const TrendIcon = trend.Icon
  const delta = (data.rate7d - data.rate30d) * 100

  return (
    <Card variant="opaque" padding="default">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">Cache hit rate</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          Anthropic prompt cache
        </span>
      </div>

      <p className="font-serif italic font-normal text-5xl md:text-6xl tracking-tight text-ink leading-none">
        {formatPct(data.rate30d)}
      </p>
      <p className="text-[12px] text-ink-mute mt-2">Moyenne 30 derniers jours</p>

      <div className="mt-5 pt-4 border-t border-rule/50 flex items-center justify-between gap-3 text-[12px]">
        <span className="text-ink-mute">7 derniers jours</span>
        <span className="font-mono text-ink font-medium">{formatPct(data.rate7d)}</span>
      </div>
      <div
        className={`mt-2 flex items-center justify-end gap-1.5 text-[11px] ${trend.color}`}
        aria-label={`Tendance ${trend.label}`}
      >
        <TrendIcon className="size-3" aria-hidden />
        <span className="font-mono">
          {trend.label} ({delta >= 0 ? '+' : ''}
          {delta.toFixed(1)} pt)
        </span>
      </div>
    </Card>
  )
}
