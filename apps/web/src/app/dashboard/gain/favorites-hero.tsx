import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface FavoriteKpi {
  /** Label uppercase mono — courte description. */
  label: string
  /** Valeur principale (chiffre + unité fusionnés ou séparés). */
  value: string
  /** Unité optionnelle (sera affichée plus petite). */
  unit?: string
  /** Delta vs période précédente — string formatée (ex: "+12%"). */
  delta?: string
  /** Direction de la tendance pour colorer le badge. */
  deltaDirection?: 'up' | 'down' | 'neutral'
  /** Courbe sparkline 30j (10-30 points), normalisée 0-1 — affichée en background. */
  sparkline?: number[]
  /** Couleur d'accent catégorielle pour la sparkline (hex). */
  sparkColor?: string
}

interface FavoritesHeroCardProps {
  /** Période affichée (ex: "ce mois", "7 derniers jours"). */
  periodLabel: string
  /** 4 KPIs hero — toujours 4 cases dans la grille 2×2. */
  kpis: [FavoriteKpi, FavoriteKpi, FavoriteKpi, FavoriteKpi]
}

/**
 * Card hero "Favoris" — pattern Apple Santé Résumé tab.
 *
 * Layout 2×2 grid avec 4 KPI dramatisés :
 *  - Valeur Instrument Serif italic 48-56px (signature KOVAS)
 *  - Label JetBrains Mono 11px uppercase tracking 0.15em
 *  - Mini trend badge mono 10px (vert/rouge selon delta)
 *  - Mini sparkline SVG 30j en background opacity 12% (line chart minimal)
 *
 * Background : Card variant="opaque" radius 24px (glass-opaque doux), pas
 * de gradient — DS v5 strict sobre. Sparklines servent d'ambiance subtile.
 */
export function FavoritesHeroCard({ periodLabel, kpis }: FavoritesHeroCardProps) {
  return (
    <Card variant="opaque" padding="none" className="rounded-[24px] overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 flex-wrap border-b border-rule/60 px-6 py-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-mute">
          Favoris · {periodLabel}
        </p>
        <p className="font-mono text-[10px] text-ink-mute/80 tracking-[0.08em] uppercase">
          4 indicateurs clés
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2">
        {kpis.map((k, idx) => (
          <FavoriteCell
            key={k.label}
            kpi={k}
            isRight={idx % 2 === 1}
            isBottom={idx >= 2}
          />
        ))}
      </div>
    </Card>
  )
}

function FavoriteCell({
  kpi,
  isRight,
  isBottom,
}: {
  kpi: FavoriteKpi
  isRight: boolean
  isBottom: boolean
}) {
  return (
    <div
      className={cn(
        'relative px-6 py-6 sm:py-7 overflow-hidden',
        !isRight && 'sm:border-r border-rule/60',
        !isBottom && 'border-b border-rule/60',
      )}
    >
      {/* Sparkline en background, opacity discrète */}
      {kpi.sparkline && kpi.sparkline.length >= 2 && (
        <SparklineBg
          points={kpi.sparkline}
          color={kpi.sparkColor ?? '#0F1419'}
        />
      )}

      <div className="relative z-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-mute mb-3">
          {kpi.label}
        </p>

        <div className="flex items-baseline gap-1.5">
          <p className="font-serif italic font-normal leading-none tracking-tight text-ink text-[44px] sm:text-[52px] tabular-nums">
            {kpi.value}
          </p>
          {kpi.unit && (
            <span className="font-sans not-italic font-normal text-base text-ink-mute">
              {kpi.unit}
            </span>
          )}
        </div>

        {kpi.delta && (
          <div className="mt-3">
            <DeltaBadge value={kpi.delta} direction={kpi.deltaDirection ?? 'neutral'} />
          </div>
        )}
      </div>
    </div>
  )
}

function DeltaBadge({
  value,
  direction,
}: {
  value: string
  direction: 'up' | 'down' | 'neutral'
}) {
  const arrow = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '·'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-2 py-0.5 font-mono text-[10px] tracking-[0.05em]',
        direction === 'up' && 'bg-accent-green/10 text-accent-green',
        direction === 'down' && 'bg-accent-red/10 text-accent-red',
        direction === 'neutral' && 'bg-rule/40 text-ink-mute',
      )}
    >
      <span aria-hidden>{arrow}</span>
      {value}
    </span>
  )
}

/**
 * Sparkline SVG 30j en background — line chart minimal sans axes.
 * Affichée en `opacity-[0.12]` pour rester ambiante (pas focal).
 */
function SparklineBg({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null

  const width = 280
  const height = 64
  const padding = 4

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1

  const step = (width - padding * 2) / (points.length - 1)

  const path = points
    .map((p, i) => {
      const x = padding + i * step
      const y = padding + (1 - (p - min) / range) * (height - padding * 2)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="absolute bottom-0 right-0 w-[60%] h-16 opacity-[0.14] pointer-events-none"
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
