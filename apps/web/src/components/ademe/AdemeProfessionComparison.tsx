/**
 * KOVAS — Comparaison anonyme vs profession.
 *
 * 4 barres horizontales : P25 · Médiane · P75 · Votre cabinet.
 * Métrique sélectionnable : ratio F/G (V1 unique). V2 : volume / surface / distance.
 *
 * Server component (statique). Si un jour on veut un dropdown métrique on
 * passera client. Pour V1 on prend le ratio_fg comme métrique unique.
 */

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface AdemeProfessionComparisonProps {
  /** Ratio F/G du cabinet (0-1). */
  yourRatio: number | null
  /** Médiane nationale (constante 0.27 par défaut). */
  national?: { p25: number; median: number; p75: number }
}

const DEFAULT_NATIONAL = { p25: 0.18, median: 0.27, p75: 0.36 }

export function AdemeProfessionComparison({
  yourRatio,
  national = DEFAULT_NATIONAL,
}: AdemeProfessionComparisonProps) {
  // Plage d'affichage 0-50% pour bonne lisibilité
  const max = 0.5

  const items: Array<{ label: string; value: number; tone: 'muted' | 'accent' | 'national' }> = [
    { label: 'P25 profession', value: national.p25, tone: 'muted' },
    { label: 'Médiane nationale', value: national.median, tone: 'national' },
    { label: 'P75 profession', value: national.p75, tone: 'muted' },
    { label: 'Votre cabinet', value: yourRatio ?? 0, tone: 'accent' },
  ]

  return (
    <Card variant="opaque" padding="default" className="space-y-3">
      <div className="space-y-1">
        <h3 className="text-[15px] font-semibold text-ink">Comparaison anonyme</h3>
        <p className="text-[11px] text-ink-mute">Ratio F/G du cabinet vs profession</p>
      </div>
      <ul className="space-y-2">
        {items.map((item) => {
          const pct = Math.min(100, Math.round((item.value / max) * 100))
          return (
            <li key={item.label} className="space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className={cn('text-ink-mute', item.tone === 'accent' && 'font-semibold text-ink')}>
                  {item.label}
                </span>
                <span className="font-mono text-ink">
                  {yourRatio === null && item.tone === 'accent' ? '—' : `${(item.value * 100).toFixed(1)}%`}
                </span>
              </div>
              <div className="h-2.5 w-full rounded-pill bg-sage-alt">
                <div
                  className={cn(
                    'h-full rounded-pill transition-all duration-base ease-spring',
                    item.tone === 'accent' && 'bg-chartreuse',
                    item.tone === 'national' && 'bg-ink/70',
                    item.tone === 'muted' && 'bg-ink/25',
                  )}
                  style={{ width: yourRatio === null && item.tone === 'accent' ? 0 : `${pct}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
      <p className="text-[10px] text-ink-faint">
        Source : agrégats ADEME open data + statistiques inter-cabinets anonymisées.
      </p>
    </Card>
  )
}
