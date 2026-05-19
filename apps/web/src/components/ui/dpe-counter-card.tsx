import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { DpeCounterResult, DpeAlertLevel } from '@/lib/dpe-counter'
import { microcopyFor } from '@/lib/dpe-counter'
import { AlertTriangle, Info } from 'lucide-react'

interface DpeCounterCardProps {
  data: DpeCounterResult
  /** Variant compact (smaller dans page Performance) ou hero (gros chiffre /app/account/certifications) */
  size?: 'compact' | 'hero'
  className?: string
}

const ALERT_STYLES: Record<DpeAlertLevel, { bar: string; badge: string; icon: 'none' | 'info' | 'warning' }> = {
  none: { bar: 'bg-chartreuse', badge: 'bg-muted text-ink-mute', icon: 'none' },
  info: { bar: 'bg-amber', badge: 'bg-amber/15 text-amber', icon: 'info' },
  warning: {
    bar: 'bg-accent-orange',
    badge: 'bg-accent-orange/15 text-accent-orange',
    icon: 'warning',
  },
  critical: { bar: 'bg-danger', badge: 'bg-danger/15 text-danger', icon: 'warning' },
  exceeded: { bar: 'bg-danger', badge: 'bg-danger text-paper', icon: 'warning' },
}

/**
 * DpeCounterCard — affichage compteur DPE annuel + alerte selon seuil.
 * Wireframe v4 §12.3 + CLAUDE.md §4 Certifications.
 *
 * Hero variant (sur /app/account/certifications V1.5) :
 *   Quota DPE 2026
 *   287 / 1000 (Instrument Serif italic 72px)
 *   ▬▬▬░░░░░░░ 28.7%
 *   Marge confortable. À ce rythme : 720/an.
 */
export function DpeCounterCard({ data, size = 'compact', className }: DpeCounterCardProps) {
  const styles = ALERT_STYLES[data.alertLevel]
  const microcopy = microcopyFor(data)
  const Icon = styles.icon === 'warning' ? AlertTriangle : styles.icon === 'info' ? Info : null

  return (
    <Card className={cn('p-6 md:p-8 space-y-5', className)}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">
          Quota DPE {data.year}
        </p>
        {data.alertLevel !== 'none' && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold',
              styles.badge,
            )}
          >
            {Icon && <Icon className="size-3.5" strokeWidth={2} />}
            {data.alertLevel === 'info' && 'Attention'}
            {data.alertLevel === 'warning' && 'Surveillance'}
            {data.alertLevel === 'critical' && 'Critique'}
            {data.alertLevel === 'exceeded' && 'Limite atteinte'}
          </span>
        )}
      </div>

      <div className="flex items-baseline gap-3 flex-wrap">
        <p
          className={cn(
            'font-serif italic font-normal leading-none tracking-tight text-ink',
            size === 'hero' ? 'text-7xl md:text-8xl' : 'text-5xl md:text-6xl',
          )}
        >
          {data.count}
        </p>
        <p className="text-2xl md:text-3xl text-ink-mute font-light">
          / {data.limit}
        </p>
      </div>

      {/* Barre de progression */}
      <div className="space-y-2">
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-base', styles.bar)}
            style={{ width: `${Math.min(data.percentage, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-ink-mute">
          <span>{data.percentage}% utilisé</span>
          <span>{data.remaining} restants</span>
        </div>
      </div>

      <p className={cn('text-sm', data.alertLevel === 'none' ? 'text-ink-mute' : 'text-ink')}>
        {microcopy}
      </p>
    </Card>
  )
}
