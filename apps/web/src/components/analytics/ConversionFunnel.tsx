/**
 * <ConversionFunnel> — funnel devis envoyés → signés (visuel non-Recharts).
 */

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Props {
  sent: number
  accepted: number
  /** Devis "signés" (electronic signature). */
  signed: number
  className?: string
}

function pct(num: number, denom: number): string {
  if (denom <= 0) return '—'
  return `${Math.round((num / denom) * 100)}%`
}

export function ConversionFunnel({ sent, accepted, signed, className }: Props) {
  const max = Math.max(sent, accepted, signed, 1)
  const barWidth = (v: number) => `${Math.max(8, (v / max) * 100)}%`

  return (
    <Card variant="flat" padding="default" className={cn('space-y-4', className)}>
      <h3 className="font-sans font-semibold text-[15px] text-ink">Conversion devis</h3>

      <div className="space-y-3">
        <FunnelRow
          label="Envoyés"
          value={sent}
          width={barWidth(sent)}
          color="#0F1419"
          baseHint={null}
        />
        <FunnelRow
          label="Acceptés"
          value={accepted}
          width={barWidth(accepted)}
          color="#3A4046"
          baseHint={`${pct(accepted, sent)} d'acceptation`}
        />
        <FunnelRow
          label="Signés"
          value={signed}
          width={barWidth(signed)}
          color="#D4F542"
          baseHint={`${pct(signed, sent)} de conversion totale`}
        />
      </div>
    </Card>
  )
}

function FunnelRow({
  label,
  value,
  width,
  color,
  baseHint,
}: {
  label: string
  value: number
  width: string
  color: string
  baseHint: string | null
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-ink-mute">{label}</span>
        <span className="font-semibold tabular-nums text-ink">{value}</span>
      </div>
      <div className="h-3 rounded-pill bg-sage-alt overflow-hidden">
        <div
          className="h-full rounded-pill transition-all duration-base ease-spring"
          style={{ width, backgroundColor: color }}
        />
      </div>
      {baseHint ? <p className="text-[10px] text-ink-faint font-mono">{baseHint}</p> : null}
    </div>
  )
}
