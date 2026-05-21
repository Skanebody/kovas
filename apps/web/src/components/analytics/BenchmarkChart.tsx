/**
 * <BenchmarkChart> — barres horizontales : votre valeur vs P25 / médiane / P75.
 *
 * Anti-déduction : si sampleSize < 5 → masque l'affichage avec un message.
 * Bandeau recommandation IA optionnel.
 */

import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { BENCHMARK_MIN_SAMPLE_SIZE } from '@/lib/analytics/types'
import { cn } from '@/lib/utils'

interface Props {
  label: string
  unit?: string
  yourValue: number | null
  p25: number | null
  median: number | null
  p75: number | null
  sampleSize: number
  formatter?: (value: number) => string
  /** Recommandation IA optionnelle ("Augmente progressivement tes tarifs"). */
  recommendation?: string | null
  className?: string
}

const BAR_COLORS = {
  p25: '#D5CDB8', // rule pale
  median: '#7E8AA4', // ink-faint
  p75: '#D5CDB8',
  you: '#D4F542', // chartreuse — accent unique
}

function defaultFormatter(v: number): string {
  return v.toLocaleString('fr-FR', { maximumFractionDigits: 1 })
}

/** Position percentile [0..1] de yourValue dans la distribution {p25,median,p75}. */
function approximatePercentile(
  you: number | null,
  p25: number | null,
  median: number | null,
  p75: number | null,
): number | null {
  if (you == null || median == null) return null
  if (p25 != null && you <= p25) return 0.25
  if (p75 != null && you >= p75) return 0.75
  if (you <= median) {
    if (p25 == null) return 0.5
    if (median === p25) return 0.5
    return 0.25 + ((you - p25) / (median - p25)) * 0.25
  }
  if (p75 == null) return 0.5
  if (median === p75) return 0.5
  return 0.5 + ((you - median) / (p75 - median)) * 0.25
}

export function BenchmarkChart({
  label,
  unit,
  yourValue,
  p25,
  median,
  p75,
  sampleSize,
  formatter = defaultFormatter,
  recommendation,
  className,
}: Props) {
  // Anti-déduction k-anonymity strict.
  if (sampleSize < BENCHMARK_MIN_SAMPLE_SIZE) {
    return (
      <Card variant="flat" padding="default" className={cn('space-y-3', className)}>
        <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-ink-mute">{label}</p>
        <p className="text-[13px] text-ink-faint italic">
          Comparaison indisponible : moins de {BENCHMARK_MIN_SAMPLE_SIZE} cabinets dans
          l&apos;échantillon.
        </p>
      </Card>
    )
  }

  const allValues = [yourValue, p25, median, p75].filter((v): v is number => typeof v === 'number')
  if (allValues.length === 0) {
    return (
      <Card variant="flat" padding="default" className={cn('space-y-3', className)}>
        <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-ink-mute">{label}</p>
        <p className="text-[13px] text-ink-faint italic">Aucune donnée disponible.</p>
      </Card>
    )
  }
  const max = Math.max(...allValues)

  const bar = (value: number | null) => (value == null || max === 0 ? 0 : (value / max) * 100)

  const percentile = approximatePercentile(yourValue, p25, median, p75)
  const percentileLabel = percentile != null ? `${Math.round(percentile * 100)}e percentile` : null

  return (
    <Card variant="flat" padding="default" className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-mono uppercase tracking-[0.12em] text-ink-mute">{label}</p>
        <Badge variant="muted">{sampleSize} cabinets</Badge>
      </div>

      <div className="space-y-2">
        {[
          { key: 'you' as const, label: 'Vous', value: yourValue, color: BAR_COLORS.you },
          { key: 'p25' as const, label: 'P25', value: p25, color: BAR_COLORS.p25 },
          { key: 'median' as const, label: 'Médiane', value: median, color: BAR_COLORS.median },
          { key: 'p75' as const, label: 'P75', value: p75, color: BAR_COLORS.p75 },
        ].map((row) => (
          <div key={row.key} className="grid grid-cols-[3rem_1fr_4rem] items-center gap-2">
            <span
              className={cn(
                'text-[10px] font-mono uppercase tracking-[0.08em]',
                row.key === 'you' ? 'text-ink font-semibold' : 'text-ink-faint',
              )}
            >
              {row.label}
            </span>
            <div className="h-2 rounded-pill bg-sage-alt overflow-hidden">
              <div
                className="h-full rounded-pill transition-all duration-base ease-spring"
                style={{
                  width: `${bar(row.value)}%`,
                  backgroundColor: row.color,
                }}
              />
            </div>
            <span className="text-[11px] font-mono tabular-nums text-right text-ink">
              {row.value == null ? '—' : `${formatter(row.value)}${unit ?? ''}`}
            </span>
          </div>
        ))}
      </div>

      {percentileLabel ? (
        <p className="text-[11px] text-ink-mute font-mono">
          Vous êtes dans le <span className="text-ink font-semibold">{percentileLabel}</span>.
        </p>
      ) : null}

      {recommendation ? (
        <div className="rounded-md border border-chartreuse/40 bg-chartreuse/10 px-3 py-2">
          <p className="text-[10px] font-mono uppercase tracking-[0.12em] text-ink-mute mb-0.5">
            Recommandation
          </p>
          <p className="text-[12px] text-ink leading-relaxed">{recommendation}</p>
        </div>
      ) : null}
    </Card>
  )
}
