/**
 * KOVAS — Carte KPI hero pour le cockpit ADEME.
 *
 * Chiffre dramatisé Instrument Serif italic 60-72px sur card opaque.
 * Variante "progress" affiche une barre chartreuse (vs seuil).
 * Variante "risk" affiche un dot coloré green/yellow/red.
 *
 * Pas de glow / gradient — design system v5 strict.
 */

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface AdemeKpiCardProps {
  /** Valeur centrale (chiffre, ratio…). */
  value: string | number
  /** Label sous le chiffre. */
  label: string
  /** Hint très court (km, mois, etc.) */
  hint?: string
  /** Mode barre : valeur courante + max → barre chartreuse. */
  progress?: { current: number; max: number; warning?: number; critical?: number }
  /** Mode risk : niveau global → dot + couleur badge. */
  risk?: 'green' | 'yellow' | 'red'
  /** Écart vs référence (badge sémantique). */
  delta?: { value: number; format?: 'pp' | '%' | 'absolute'; positive_is_good?: boolean }
  className?: string
}

const RISK_LABEL: Record<'green' | 'yellow' | 'red', string> = {
  green: 'Sain',
  yellow: 'Vigilance',
  red: 'Critique',
}

const RISK_BADGE_CLASS: Record<'green' | 'yellow' | 'red', string> = {
  green: 'bg-accent-green/15 text-accent-green',
  yellow: 'bg-accent-orange/15 text-accent-orange',
  red: 'bg-accent-red/15 text-accent-red',
}

const RISK_DOT_CLASS: Record<'green' | 'yellow' | 'red', string> = {
  green: 'bg-success',
  yellow: 'bg-warning',
  red: 'bg-danger',
}

export function AdemeKpiCard({
  value,
  label,
  hint,
  progress,
  risk,
  delta,
  className,
}: AdemeKpiCardProps) {
  return (
    <Card variant="opaque" padding="default" className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-serif italic tracking-tight text-ink leading-none text-5xl md:text-6xl">
          {value}
        </p>
        {risk ? (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[11px] font-semibold',
              RISK_BADGE_CLASS[risk],
            )}
          >
            <span className={cn('size-2 rounded-full', RISK_DOT_CLASS[risk])} aria-hidden />
            {RISK_LABEL[risk]}
          </span>
        ) : null}
      </div>

      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink">{label}</p>
        {hint ? <p className="text-[11px] text-ink-mute">{hint}</p> : null}
      </div>

      {progress ? <KpiProgressBar progress={progress} /> : null}

      {delta ? <KpiDelta delta={delta} /> : null}
    </Card>
  )
}

function KpiProgressBar({ progress }: { progress: NonNullable<AdemeKpiCardProps['progress']> }) {
  const pct = Math.min(100, Math.round((progress.current / progress.max) * 100))
  const warningPct = progress.warning ? Math.round((progress.warning / progress.max) * 100) : null
  const criticalPct = progress.critical
    ? Math.round((progress.critical / progress.max) * 100)
    : null

  // Couleur de la barre selon seuil franchi
  let barClass = 'bg-chartreuse'
  if (criticalPct !== null && pct >= criticalPct) barClass = 'bg-danger'
  else if (warningPct !== null && pct >= warningPct) barClass = 'bg-warning'

  return (
    <div className="space-y-1">
      <div className="relative h-2 w-full overflow-hidden rounded-pill bg-sage-alt">
        <div
          className={cn('h-full transition-all duration-base ease-spring', barClass)}
          style={{ width: `${pct}%` }}
        />
        {warningPct !== null ? (
          <span
            className="absolute top-0 h-full w-px bg-ink/30"
            style={{ left: `${warningPct}%` }}
            aria-hidden
          />
        ) : null}
        {criticalPct !== null ? (
          <span
            className="absolute top-0 h-full w-px bg-ink/40"
            style={{ left: `${criticalPct}%` }}
            aria-hidden
          />
        ) : null}
      </div>
      <div className="flex justify-between text-[10px] font-mono text-ink-mute">
        <span>
          {progress.current} / {progress.max}
        </span>
        <span>{pct}%</span>
      </div>
    </div>
  )
}

function KpiDelta({ delta }: { delta: NonNullable<AdemeKpiCardProps['delta']> }) {
  const positive = delta.value >= 0
  const positiveIsGood = delta.positive_is_good ?? true
  const isGood = positive === positiveIsGood
  const className = isGood
    ? 'bg-accent-green/15 text-accent-green'
    : 'bg-accent-red/15 text-accent-red'

  const formatted =
    delta.format === 'pp'
      ? `${positive ? '+' : ''}${delta.value.toFixed(1)} pp`
      : delta.format === '%'
        ? `${positive ? '+' : ''}${delta.value.toFixed(1)} %`
        : `${positive ? '+' : ''}${delta.value}`

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill px-2.5 py-1 text-[11px] font-medium',
        className,
      )}
    >
      {formatted} vs référence
    </span>
  )
}
