import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export interface AdminMetricCardProps {
  /** Label mono uppercase au-dessus du chiffre. */
  eyebrow: string
  /** Valeur principale (string déjà formatée). */
  value: string
  /** Sous-titre / hint en bas. */
  hint?: string
  /** Comparaison vs hier / mois dernier (placeholder V1 → « à venir »). */
  comparison?: string | null
  /** Icône optionnelle en haut à droite. */
  icon?: LucideIcon
  className?: string
}

/**
 * Carte métrique du dashboard admin.
 *
 * Pattern v5 Synthex : Card opaque + eyebrow mono + value Instrument Serif italic.
 */
export function AdminMetricCard({
  eyebrow,
  value,
  hint,
  comparison,
  icon: Icon,
  className,
}: AdminMetricCardProps) {
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

      <p className="mt-3 text-[11px] text-ink-faint">{comparison ?? 'vs hier · à venir'}</p>
    </Card>
  )
}
