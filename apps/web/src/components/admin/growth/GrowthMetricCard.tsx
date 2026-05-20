import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from 'lucide-react'

export interface GrowthMetricCardProps {
  eyebrow: string
  value: string
  hint?: string
  /** Variation pondérée (-1..+1 typique) ; null = pas de trend connu. */
  trend?: number | null
  /** Texte explicatif court (« vs 7j » / « vs mois -1 »). */
  trendLabel?: string
  icon?: LucideIcon
  className?: string
}

/**
 * Variante du metric card admin pour la section Croissance.
 *
 * Ajoute une trend arrow (↗ ↘ →) colorée selon le signe — utile sur les
 * KPI d'évolution (signups, activation, sticky ratio).
 */
export function GrowthMetricCard({
  eyebrow,
  value,
  hint,
  trend,
  trendLabel,
  icon: Icon,
  className,
}: GrowthMetricCardProps) {
  const hasTrend = typeof trend === 'number' && Number.isFinite(trend)
  const trendDirection = !hasTrend ? 'flat' : trend > 0.01 ? 'up' : trend < -0.01 ? 'down' : 'flat'

  const TrendIcon =
    trendDirection === 'up' ? ArrowUpRight : trendDirection === 'down' ? ArrowDownRight : ArrowRight

  const trendColor =
    trendDirection === 'up'
      ? 'text-success'
      : trendDirection === 'down'
        ? 'text-accent-red'
        : 'text-ink-faint'

  const trendText = hasTrend
    ? `${trend > 0 ? '+' : ''}${(trend * 100).toFixed(1)}%`
    : (trendLabel ?? 'vs période précédente · à venir')

  return (
    <Card variant="opaque" padding="default" className={cn('relative', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">{eyebrow}</p>
        {Icon ? <Icon className="size-4 text-ink-faint" aria-hidden /> : null}
      </div>

      <p className="mt-3 font-serif italic font-normal text-4xl md:text-5xl tracking-tight text-ink leading-none">
        {value}
      </p>

      {hint ? <p className="mt-2 text-sm text-ink-mute">{hint}</p> : null}

      <p className={cn('mt-3 inline-flex items-center gap-1.5 text-[11px]', trendColor)}>
        <TrendIcon className="size-3" aria-hidden />
        <span>{trendText}</span>
        {hasTrend && trendLabel ? <span className="text-ink-faint"> · {trendLabel}</span> : null}
      </p>
    </Card>
  )
}
