import { cn } from '@/lib/utils'
import { TrendingDown, TrendingUp } from 'lucide-react'

export type KpiHeroProps = {
  value: string | number
  label: string
  hint?: string
  /** Variation % vs période précédente (null = masqué) */
  trend?: number | null
  className?: string
  /** Mise en avant visuelle (Ron — chiffre hero) */
  featured?: boolean
}

/**
 * KPI dramatisé — Instrument Serif italic sur le chiffre (registre Ron / Tectra).
 */
export function KpiHero({ value, label, hint, trend, className, featured }: KpiHeroProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-rule/80 glass-opaque p-5 shadow-glass-sm',
        featured && 'md:col-span-2 md:row-span-2 md:p-8',
        className,
      )}
    >
      <p
        className={cn(
          'font-serif italic tracking-tight text-ink leading-none',
          featured ? 'text-6xl md:text-7xl' : 'text-4xl md:text-5xl',
        )}
      >
        {value}
      </p>
      <p className={cn('mt-3 font-semibold text-ink', featured ? 'text-lg' : 'text-sm')}>
        {label}
      </p>
      {hint ? <p className="mt-1 text-sm text-ink-mute">{hint}</p> : null}
      {trend !== null && trend !== undefined ? (
        <p
          className={cn(
            'mt-2 inline-flex items-center gap-1 text-xs font-medium rounded-pill px-2.5 py-1',
            trend >= 0
              ? 'bg-accent-green/15 text-accent-green'
              : 'bg-accent-red/15 text-accent-red',
          )}
        >
          {trend >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
          {trend >= 0 ? '+' : ''}
          {trend}% vs semaine dernière
        </p>
      ) : null}
    </div>
  )
}
