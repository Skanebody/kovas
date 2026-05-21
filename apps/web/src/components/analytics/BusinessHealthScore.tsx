/**
 * <BusinessHealthScore> — score composite 0-100 + breakdown 4 axes.
 *
 * Visuel : anneau SVG circulaire, couleur graduée
 *   - red    < 40
 *   - yellow 40 – 70
 *   - green  > 70
 *
 * Breakdown pondéré :
 *   - revenue 30%
 *   - conversion 20%
 *   - diversity 20%
 *   - growth 30%
 */

import { Card } from '@/components/ui/card'
import { type HealthScoreBreakdown, healthScoreColor } from '@/lib/analytics/types'
import { cn } from '@/lib/utils'

interface Props {
  breakdown: HealthScoreBreakdown
  className?: string
}

const COLOR_CLASS: Record<ReturnType<typeof healthScoreColor>, string> = {
  red: 'text-accent-red',
  yellow: 'text-[#95B11A]',
  green: 'text-accent-green',
}

const COLOR_STROKE: Record<ReturnType<typeof healthScoreColor>, string> = {
  red: '#DC2626',
  yellow: '#D97706',
  green: '#059669',
}

const COLOR_LABEL: Record<ReturnType<typeof healthScoreColor>, string> = {
  red: 'À surveiller',
  yellow: 'En progression',
  green: 'Excellent',
}

function ScoreBar({ label, value, weight }: { label: string; value: number; weight: number }) {
  const color = healthScoreColor(value)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-ink-mute">
          {label} <span className="text-ink-faint">· {weight}%</span>
        </span>
        <span className={cn('font-semibold tabular-nums', COLOR_CLASS[color])}>{value}</span>
      </div>
      <div className="h-1.5 rounded-pill bg-sage-alt overflow-hidden">
        <div
          className="h-full rounded-pill transition-all duration-base ease-spring"
          style={{ width: `${value}%`, backgroundColor: COLOR_STROKE[color] }}
        />
      </div>
    </div>
  )
}

export function BusinessHealthScore({ breakdown, className }: Props) {
  const color = healthScoreColor(breakdown.total)
  const radius = 60
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (breakdown.total / 100) * circumference

  return (
    <Card variant="flat" padding="default" className={cn('space-y-5', className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-ink-mute">
            Health score
          </p>
          <p className={cn('text-[13px] font-semibold mt-0.5', COLOR_CLASS[color])}>
            {COLOR_LABEL[color]}
          </p>
        </div>
        <div className="relative size-[150px]">
          <svg
            viewBox="0 0 150 150"
            className="size-full -rotate-90"
            role="img"
            aria-label={`Score de santé business : ${breakdown.total} sur 100`}
          >
            <title>Health score {breakdown.total} / 100</title>
            <circle
              cx="75"
              cy="75"
              r={radius}
              fill="none"
              stroke="rgba(15,20,25,0.06)"
              strokeWidth="10"
            />
            <circle
              cx="75"
              cy="75"
              r={radius}
              fill="none"
              stroke={COLOR_STROKE[color]}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-500 ease-spring"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('font-serif italic text-5xl leading-none', COLOR_CLASS[color])}>
              {breakdown.total}
            </span>
            <span className="text-[10px] font-mono uppercase tracking-[0.1em] text-ink-faint mt-1">
              / 100
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <ScoreBar label="CA HT" value={breakdown.revenue} weight={30} />
        <ScoreBar label="Conversion" value={breakdown.conversion} weight={20} />
        <ScoreBar label="Diversité prescripteurs" value={breakdown.diversity} weight={20} />
        <ScoreBar label="Croissance" value={breakdown.growth} weight={30} />
      </div>
    </Card>
  )
}
