'use client'

import type { QuotaWarning } from '@/lib/admin/dpe-quota-tracker'
import { cn } from '@/lib/utils'
import { AlertOctagon, AlertTriangle, Info } from 'lucide-react'

interface DpeQuotaWarningProps {
  warning: QuotaWarning | null
  /** Position sticky en haut du form (false = inline). */
  sticky?: boolean
  className?: string
}

/**
 * Banner d'alerte quota DPE (limite légale 1000/an/diagnostiqueur sur 12 mois
 * glissants — article R134-4-3 CCH).
 *
 * Couleurs selon severity :
 *   - info     → yellow-mist (≥ 80%, encore safe)
 *   - warning  → orange-mist (≥ 95%, attention)
 *   - critical → coral-mist + border danger (≥ 100%, submit bloqué)
 *
 * Affiche count/limit, percentUsed, daysUntilQuotaFrees, et le message
 * généré côté backend (avatar SOBRE).
 */
export function DpeQuotaWarning({ warning, sticky = false, className }: DpeQuotaWarningProps) {
  if (!warning) return null

  const palette = paletteFor(warning.severity)

  return (
    <div
      className={cn(
        'rounded-lg border border-l-4 p-4 space-y-2 shadow-glass-sm',
        palette.bg,
        palette.border,
        sticky && 'sticky top-2 z-30',
        className,
      )}
      role={warning.severity === 'critical' ? 'alert' : 'status'}
    >
      <div className="flex items-start gap-2">
        <palette.icon className={cn('size-4 mt-0.5 shrink-0', palette.text)} />
        <div className="space-y-1.5 flex-1 min-w-0">
          <p className={cn('text-[13px] font-semibold', palette.text)}>
            Quota DPE — {warning.count} / {warning.limit} sur 12 mois glissants
          </p>
          <p className="text-[12px] text-ink">{warning.message}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-mute font-mono tabular-nums">
            <span>{warning.percentUsed.toFixed(1)}% utilisé</span>
            {warning.daysUntilQuotaFrees > 0 && (
              <span>Quota libéré dans {warning.daysUntilQuotaFrees} j</span>
            )}
          </div>
          {/* Barre de progression discrète */}
          <div className="h-1 w-full rounded-full bg-rule/40 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', palette.bar)}
              style={{ width: `${Math.min(100, warning.percentUsed)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

interface Palette {
  bg: string
  border: string
  text: string
  bar: string
  icon: typeof Info
}

function paletteFor(severity: QuotaWarning['severity']): Palette {
  switch (severity) {
    case 'critical':
      return {
        bg: 'bg-coral-mist',
        border: 'border-rule border-l-danger',
        text: 'text-danger',
        bar: 'bg-danger',
        icon: AlertOctagon,
      }
    case 'warning':
      return {
        bg: 'bg-orange-mist',
        border: 'border-rule border-l-[#D97706]',
        text: 'text-[#7C3F0A]',
        bar: 'bg-[#D97706]',
        icon: AlertTriangle,
      }
    default:
      return {
        bg: 'bg-blue-mist',
        border: 'border-rule border-l-[#1E3A8A]',
        text: 'text-[#1E3A8A]',
        bar: 'bg-[#1E3A8A]',
        icon: Info,
      }
  }
}
