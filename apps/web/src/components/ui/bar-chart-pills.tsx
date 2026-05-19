import { cn } from '@/lib/utils'

interface BarChartPillsProps {
  /** Données ordonnées chronologiquement (gauche → droite) */
  data: Array<{
    label: string
    value: number
    /** Affichage tooltip optionnel (par défaut = `value`) */
    tooltip?: string
  }>
  /** Hauteur du graphique en pixels (default 160) */
  height?: number
  /** Largeur d'une pilule en pixels (default 14) */
  barWidth?: number
  /** Espacement entre pilules (default 12) */
  gap?: number
  /** Couleur des pilules (default navy KOVAS) */
  barColor?: string
  /** Couleur du point au sommet (default chartreuse v5 — `#D4F542`) */
  dotColor?: string
  /** Afficher le point au sommet (default true) */
  showDots?: boolean
  /** Afficher les valeurs sous les labels (default false) */
  showValues?: boolean
  /** Label de la valeur maximale (axe Y discret) */
  maxLabel?: string
  className?: string
}

/**
 * BarChartPills — signature visuelle v5 (Synthex pattern, doc §4.5).
 * Chaque barre est une pilule verticale (border-radius = width/2)
 * avec un point optionnel au sommet en accent chartreuse `#D4F542`.
 *
 * Usages canoniques :
 * - Évolution missions 12 mois
 * - GainTracker temps économisé
 * - Volume par diagnostic
 * - CA HT mensuel (Performance)
 *
 * Implémentation SVG pure (pas de Recharts) pour avoir contrôle exact
 * sur le radius des pilules et la position des dots.
 */
export function BarChartPills({
  data,
  height = 160,
  barWidth = 14,
  gap = 12,
  barColor = '#0F2436',
  dotColor = '#D4F542',
  showDots = true,
  showValues = false,
  maxLabel,
  className,
}: BarChartPillsProps) {
  if (data.length === 0) return null

  const max = Math.max(...data.map((d) => d.value), 1)
  const chartHeight = height - 36 // -36 pour labels axe X
  const width = data.length * (barWidth + gap) - gap
  const labelStep = Math.ceil(data.length / 12) // Limite labels affichés

  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Évolution mensuelle"
        className="block"
      >
        <title>Évolution mensuelle</title>
        {data.map((point, i) => {
          const ratio = point.value / max
          const barHeight = Math.max(ratio * chartHeight, barWidth) // Min = round dot
          const x = i * (barWidth + gap)
          const y = chartHeight - barHeight
          const cx = x + barWidth / 2
          const labelVisible = i % labelStep === 0 || i === data.length - 1

          return (
            <g key={`${point.label}-${i}`}>
              {/* Pilule */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={barWidth / 2}
                ry={barWidth / 2}
                fill={barColor}
                opacity={point.value === 0 ? 0.15 : 1}
              />
              {/* Dot chartreuse au sommet (uniquement si value > 0) */}
              {showDots && point.value > 0 && (
                <circle cx={cx} cy={y + barWidth / 2} r={3.5} fill={dotColor} />
              )}
              {/* Label axe X (mois) */}
              {labelVisible && (
                <text
                  x={cx}
                  y={chartHeight + 16}
                  textAnchor="middle"
                  className="font-mono"
                  style={{ fontSize: '10px', fill: '#5A6B78' }}
                >
                  {point.label}
                </text>
              )}
              {/* Valeur au-dessus si demandé */}
              {showValues && point.value > 0 && (
                <text
                  x={cx}
                  y={y - 6}
                  textAnchor="middle"
                  style={{ fontSize: '10px', fontWeight: 600, fill: '#163144' }}
                >
                  {point.value}
                </text>
              )}
            </g>
          )
        })}
      </svg>
      {maxLabel && (
        <div className="flex justify-between mt-2 text-[10px] text-ink-mute font-mono">
          <span>0</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  )
}

/**
 * Helper — construit les 12 derniers mois à partir d'une map { 'YYYY-MM': value }.
 * Mois en français abrégés (J/F/M/A/M/J/J/A/S/O/N/D).
 */
export function buildLast12MonthsData(values: Record<string, number>): BarChartPillsProps['data'] {
  const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
  const now = new Date()
  const result: BarChartPillsProps['data'] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const yyyymm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    result.push({
      label: months[d.getMonth()],
      value: values[yyyymm] ?? 0,
    })
  }
  return result
}
