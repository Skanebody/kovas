/**
 * Synthèse rapide latence / error rate / cache hit pour la section Alertes.
 *
 * Server component : valeurs déjà calculées par les libs ia-analytics +
 * health checks et passées en props.
 */

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Activity, Database, Timer } from 'lucide-react'

interface PerformanceMetricsProps {
  latencyP50ms: number
  latencyP95ms: number
  cacheHit30d: number
  errorRate60min: number
}

function formatMs(ms: number): string {
  if (ms === 0) return '—'
  if (ms < 1000) return `${ms} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function pct(v: number, digits = 1): string {
  return `${(v * 100).toFixed(digits)}%`
}

export function PerformanceMetrics({
  latencyP50ms,
  latencyP95ms,
  cacheHit30d,
  errorRate60min,
}: PerformanceMetricsProps) {
  const errorStatus =
    errorRate60min >= 0.05
      ? 'text-accent-red'
      : errorRate60min >= 0.02
        ? 'text-warning'
        : 'text-success'

  return (
    <Card variant="opaque" padding="default">
      <h2 className="text-[15px] font-semibold tracking-tight text-ink flex items-center gap-2 mb-4">
        <Activity className="size-4 text-ink-mute" aria-hidden />
        Performance
      </h2>

      <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[12px]">
        <li className="rounded-md border border-rule/60 bg-paper/60 px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <Timer className="size-3 text-ink-mute" aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
              Latence p50 / p95
            </span>
          </div>
          <p className="mt-1.5 text-ink font-mono">
            {formatMs(latencyP50ms)} <span className="text-ink-faint">/</span>{' '}
            <span className="font-semibold">{formatMs(latencyP95ms)}</span>
          </p>
        </li>
        <li className="rounded-md border border-rule/60 bg-paper/60 px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <Database className="size-3 text-ink-mute" aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
              Cache hit 30j
            </span>
          </div>
          <p className="mt-1.5 text-ink font-mono font-semibold">{pct(cacheHit30d)}</p>
        </li>
        <li className="rounded-md border border-rule/60 bg-paper/60 px-3 py-2.5">
          <div className="flex items-center gap-1.5">
            <Activity className="size-3 text-ink-mute" aria-hidden />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
              Erreurs 60min
            </span>
          </div>
          <p className={cn('mt-1.5 font-mono font-semibold', errorStatus)}>
            {pct(errorRate60min, 2)}
          </p>
        </li>
      </ul>
    </Card>
  )
}
