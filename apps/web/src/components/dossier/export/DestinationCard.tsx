'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
/**
 * KOVAS — Carte de destination d'export (Partition D).
 *
 * Layout : icon left (48x48 sage bg) · content middle (titre + badge optionnel
 * "Recommandé" + description + ligne statut) · action right (bouton "Exporter").
 *
 * Border navy si `recommended`, sinon `border-rule`.
 *
 * Authority : design system v5 (sage/navy/chartreuse) + ton sobre B2B.
 */
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, Check, Info, Loader2 } from 'lucide-react'

export type DestinationStatusType = 'warning' | 'success' | 'default'

export interface DestinationStatus {
  type: DestinationStatusType
  text: string
}

interface DestinationCardProps {
  icon: LucideIcon
  name: string
  description: string
  status: DestinationStatus
  recommended?: boolean
  loading?: boolean
  disabled?: boolean
  ctaLabel?: string
  onExport: () => void | Promise<void>
}

const STATUS_STYLES: Record<DestinationStatusType, { icon: LucideIcon; color: string }> = {
  warning: { icon: AlertTriangle, color: 'text-accent-orange' },
  success: { icon: Check, color: 'text-accent-green' },
  default: { icon: Info, color: 'text-ink-faint' },
}

export function DestinationCard({
  icon: Icon,
  name,
  description,
  status,
  recommended = false,
  loading = false,
  disabled = false,
  ctaLabel = 'Exporter',
  onExport,
}: DestinationCardProps) {
  const StatusIcon = STATUS_STYLES[status.type].icon
  const statusColor = STATUS_STYLES[status.type].color

  return (
    <div
      className={cn(
        'rounded-lg border p-4 flex items-center gap-4',
        'transition-colors duration-base',
        recommended ? 'border-navy bg-paper/60' : 'border-rule bg-paper/40',
      )}
    >
      {/* Icon left 48x48 rounded sage bg */}
      <div className="size-12 rounded-md bg-cream-deep flex items-center justify-center shrink-0">
        <Icon className="size-5 text-ink" />
      </div>

      {/* Content middle */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-semibold text-ink truncate">{name}</h3>
          {recommended && (
            <Badge variant="default" className="bg-chartreuse text-ink shrink-0">
              Recommandé
            </Badge>
          )}
        </div>
        <p className="text-[12px] text-ink-mute mb-1.5 line-clamp-2">{description}</p>
        <div className={cn('flex items-center gap-1.5 text-[11px]', statusColor)}>
          <StatusIcon className="size-3 shrink-0" />
          <span>{status.text}</span>
        </div>
      </div>

      {/* Action right */}
      <div className="shrink-0">
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || loading}
          onClick={() => {
            void onExport()
          }}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
          {ctaLabel}
        </Button>
      </div>
    </div>
  )
}
