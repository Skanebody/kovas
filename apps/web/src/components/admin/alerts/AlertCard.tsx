'use client'

/**
 * Carte unitaire d'une alerte active.
 *
 * Affiche : severity badge color · nom de la règle · actual_value vs threshold ·
 * target_label · payload essentiel · actions (Résoudre / Voir détail).
 */

import type { AlertEventDto } from '@/app/api/admin/alerts/route'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AlertOctagon, AlertTriangle, Info } from 'lucide-react'

const SEVERITY_STYLES: Record<
  'info' | 'warning' | 'critical',
  { dot: string; label: string; chip: string; icon: typeof Info }
> = {
  info: {
    dot: 'bg-accent-blue',
    label: 'Info',
    chip: 'bg-accent-blue/12 text-accent-blue ring-accent-blue/20',
    icon: Info,
  },
  warning: {
    dot: 'bg-warning',
    label: 'Warning',
    chip: 'bg-warning/12 text-warning ring-warning/20',
    icon: AlertTriangle,
  },
  critical: {
    dot: 'bg-accent-red',
    label: 'Critical',
    chip: 'bg-accent-red/12 text-accent-red ring-accent-red/20',
    icon: AlertOctagon,
  },
}

function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  return `il y a ${d} j`
}

function formatNumber(n: number): string {
  if (Math.abs(n) >= 100) return n.toFixed(0)
  if (Math.abs(n) >= 1) return n.toFixed(2)
  return n.toFixed(3)
}

interface AlertCardProps {
  event: AlertEventDto
  onResolve: (event: AlertEventDto) => void
}

export function AlertCard({ event, onResolve }: AlertCardProps) {
  const style = SEVERITY_STYLES[event.rule_severity]
  const Icon = style.icon

  return (
    <Card variant="opaque" padding="default" className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={cn('inline-flex size-2.5 rounded-full shrink-0', style.dot)}
            aria-hidden
          />
          <h3 className="text-[14px] font-semibold tracking-tight text-ink truncate">
            {event.rule_name}
          </h3>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider ring-1',
            style.chip,
          )}
        >
          <Icon className="size-3" aria-hidden />
          {style.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[12px]">
        {event.target_label ? (
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              Cible
            </span>{' '}
            <span className="text-ink-mute">{event.target_label}</span>
          </div>
        ) : null}
        {event.actual_value !== null ? (
          <div>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
              Valeur
            </span>{' '}
            <span className="text-ink font-mono">{formatNumber(event.actual_value)}</span>
            {event.threshold_value !== null ? (
              <span className="text-ink-faint font-mono">
                {' '}
                / seuil {formatNumber(event.threshold_value)}
              </span>
            ) : null}
          </div>
        ) : null}
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
            Déclenchée
          </span>{' '}
          <span className="text-ink-mute">{formatTimeAgo(event.created_at)}</span>
        </div>
      </div>

      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-ink-faint">
          {event.notified_telegram ? <span title="Notifié Telegram">● TG</span> : null}
          {event.notified_email ? <span title="Notifié Email">● EM</span> : null}
        </div>
        <button
          type="button"
          onClick={() => onResolve(event)}
          className="inline-flex items-center gap-1.5 rounded-pill bg-ink/5 hover:bg-ink/10 text-ink px-3 py-1.5 text-[11px] font-medium transition-colors"
        >
          Résoudre
        </button>
      </div>
    </Card>
  )
}
