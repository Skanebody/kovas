import { Card } from '@/components/ui/card'
import type { FunnelStep } from '@/lib/admin/growth-analytics'
import { cn } from '@/lib/utils'

export interface ConversionFunnelProps {
  steps: FunnelStep[]
  /** Période (texte humain) — ex. « depuis novembre 2025 ». */
  periodLabel?: string
}

export function ConversionFunnel({ steps, periodLabel }: ConversionFunnelProps) {
  const max = steps.reduce((acc, s) => Math.max(acc, s.count), 0)
  const top = steps[0]
  const bottom = steps[steps.length - 1]
  const globalConversion = top && bottom && top.count > 0 ? (bottom.count / top.count) * 100 : 0

  return (
    <Card variant="opaque" padding="default" className="flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-ink">
            Funnel de conversion
          </h2>
          <p className="text-[12px] text-ink-mute mt-0.5">
            {periodLabel ?? 'Cohorte récente'} · {globalConversion.toFixed(1)}% bout-en-bout
          </p>
        </div>
      </div>

      <ul className="space-y-3">
        {steps.map((step, index) => {
          const widthPct = max > 0 ? (step.count / max) * 100 : 0
          const isFirst = index === 0
          return (
            <li key={step.label} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-[12px]">
                <p className="text-ink font-medium">{step.label}</p>
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span className="text-ink-mute">{step.count}</span>
                  {!isFirst ? (
                    <span
                      className={cn(
                        'tabular-nums',
                        step.dropoffPct >= 50
                          ? 'text-accent-red'
                          : step.dropoffPct >= 20
                            ? 'text-warning'
                            : 'text-success',
                      )}
                      title="Dropoff vs étape précédente"
                    >
                      −{step.dropoffPct.toFixed(1)}%
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="h-6 rounded-md bg-ink/5 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-md transition-all duration-300',
                    isFirst ? 'bg-ink' : 'bg-chartreuse',
                  )}
                  style={{ width: `${Math.max(2, widthPct)}%` }}
                  aria-hidden
                />
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
