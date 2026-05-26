import { Card } from '@/components/ui/card'
import { ChartCaption } from './chart-caption'

interface RenovationPoint {
  label: string
  count: number
  month: string
  year: number
}

interface RenovationTrendProps {
  data: readonly RenovationPoint[]
  /** Période courante affichée par le ChartCaption */
  periodLabel: string
  /** True si au moins un mois provient de l'ingestion ADEME réelle */
  isLive?: boolean
  /** True si TOUS les mois proviennent de l'ingestion ADEME (pas de fallback) */
  isFullyLive?: boolean
  /** True si mix donnée réelle + extrapolation */
  isMixed?: boolean
}

/**
 * Section 4 — Évolution du nombre de rénovations énergétiques sur 24 mois.
 *
 * Implémentation SVG pure pour rester compatible avec le checkout courant
 * (recharts pas encore dans package.json). Une refonte Recharts pourra venir
 * dans un PR ultérieur. Le rendu SVG manuel garantit un bundle léger,
 * 0 JS côté client, et un contrôle exact du styling brand v5.
 *
 * Ligne navy `#1B405B` + dot chartreuse au sommet de la dernière valeur pour
 * signaler la mise à jour la plus récente + ligne de tendance moyenne mobile
 * 3 mois en gris clair pointillé.
 */
export function RenovationTrend({
  data,
  periodLabel,
  isLive = false,
  isFullyLive = false,
  isMixed = false,
}: RenovationTrendProps) {
  if (data.length === 0) return null

  const lastValue = data[data.length - 1]?.count ?? 0
  const firstValue = data[0]?.count ?? 1
  const growthPct = Math.round(((lastValue - firstValue) / firstValue) * 100)

  // Moyenne mobile 3 mois
  const trend = data.map((_point, idx) => {
    if (idx < 2) return null
    const window = data.slice(idx - 2, idx + 1)
    return Math.round(window.reduce((sum, p) => sum + p.count, 0) / window.length)
  })

  // ============ SVG dimensions ============
  // Hauteur réduite : 240 (vs 280) pour rester compact sur desktop large.
  const W = 1000
  const H = 240
  const PAD_LEFT = 56
  const PAD_RIGHT = 16
  const PAD_TOP = 16
  const PAD_BOTTOM = 32
  const chartW = W - PAD_LEFT - PAD_RIGHT
  const chartH = H - PAD_TOP - PAD_BOTTOM

  const max = Math.max(...data.map((p) => p.count))
  const min = Math.min(...data.map((p) => p.count))
  const range = max - min || 1
  const scaleY = (v: number) => PAD_TOP + chartH - ((v - min) / range) * chartH
  const stepX = chartW / (data.length - 1 || 1)

  // Path principal (counts)
  const pathCounts = data
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${PAD_LEFT + i * stepX} ${scaleY(p.count)}`)
    .join(' ')

  // Path tendance (moyenne mobile)
  const pathTrend = trend
    .map((v, i) => {
      if (v === null) return null
      const cmd = trend.slice(0, i).every((t) => t === null) ? 'M' : 'L'
      return `${cmd} ${PAD_LEFT + i * stepX} ${scaleY(v)}`
    })
    .filter((s): s is string => s !== null)
    .join(' ')

  // Y-axis ticks : 5 paliers
  const yTicks = Array.from({ length: 5 }, (_, i) => min + (range * i) / 4)
  const xLabelStep = Math.ceil(data.length / 8)

  return (
    <Card variant="flat" padding="default" className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink/55 font-medium mb-1.5">
            Évolution 24 mois glissants
          </p>
          <p className="font-serif italic text-[34px] sm:text-[40px] text-ink leading-none">
            {lastValue.toLocaleString('fr-FR')}
            <span className="text-[14px] sm:text-[15px] text-ink-mute font-sans not-italic ml-2">
              rénovations le mois dernier
            </span>
          </p>
        </div>
        <div className="text-right">
          <span className="inline-flex items-center gap-2 rounded-pill bg-chartreuse-soft px-3 py-1.5 text-[12px] font-mono text-ink">
            +{growthPct} % sur deux ans
          </span>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label="Évolution mensuelle des rénovations énergétiques"
          className="block"
        >
          <title>Évolution mensuelle des rénovations énergétiques sur 24 mois</title>

          {/* Axe Y label */}
          <text
            x={12}
            y={PAD_TOP - 4}
            style={{ fontSize: '10px', fontFamily: 'monospace', fill: '#5B7088' }}
          >
            Rénovations (milliers)
          </text>
          {/* Axe X label */}
          <text
            x={W - PAD_RIGHT}
            y={H - 4}
            textAnchor="end"
            style={{ fontSize: '10px', fontFamily: 'monospace', fill: '#5B7088' }}
          >
            Mois
          </text>

          {/* Grid horizontal */}
          {yTicks.map((v) => (
            <line
              key={v}
              x1={PAD_LEFT}
              x2={W - PAD_RIGHT}
              y1={scaleY(v)}
              y2={scaleY(v)}
              stroke="#E7E2D2"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ))}

          {/* Y-axis labels */}
          {yTicks.map((v) => (
            <text
              key={`yl-${v}`}
              x={PAD_LEFT - 8}
              y={scaleY(v) + 3}
              textAnchor="end"
              style={{
                fontSize: '10px',
                fontFamily: 'monospace',
                fill: '#5B7088',
              }}
            >
              {Math.round(v / 1000)}k
            </text>
          ))}

          {/* X-axis labels (1 sur N) */}
          {data.map((p, i) => {
            if (i % xLabelStep !== 0 && i !== data.length - 1) return null
            return (
              <text
                key={`xl-${p.year}-${p.month}-${i}`}
                x={PAD_LEFT + i * stepX}
                y={H - PAD_BOTTOM + 18}
                textAnchor="middle"
                style={{
                  fontSize: '10px',
                  fontFamily: 'monospace',
                  fill: '#5B7088',
                }}
              >
                {p.label}
              </text>
            )
          })}

          {/* Tendance (moyenne mobile) */}
          {pathTrend && (
            <path
              d={pathTrend}
              fill="none"
              stroke="#B8C2D2"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
          )}

          {/* Ligne principale */}
          <path d={pathCounts} fill="none" stroke="#1B405B" strokeWidth={2} />

          {/* Dots sur chaque point */}
          {data.map((p, i) => (
            <circle
              key={`dot-${p.year}-${p.month}-${i}`}
              cx={PAD_LEFT + i * stepX}
              cy={scaleY(p.count)}
              r={2.5}
              fill="#1B405B"
            />
          ))}

          {/* Dernier dot chartreuse pour signaler le mois courant */}
          <circle
            cx={PAD_LEFT + (data.length - 1) * stepX}
            cy={scaleY(lastValue)}
            r={6}
            fill="#D4F542"
            stroke="#1B405B"
            strokeWidth={1.5}
          />
        </svg>
      </div>
      <ChartCaption
        howToRead="La courbe pleine navy retrace le nombre mensuel de rénovations énergétiques engagées au niveau national, mesuré par les DPE émis en classe A-C sur la fenêtre. La ligne pointillée grise est la moyenne mobile 3 mois qui neutralise la saisonnalité (creux estival juillet-août). Le point chartreuse marque la valeur la plus récente."
        source={
          isFullyLive
            ? 'Agrégation directe ADEME DPE v2 logements existants (open data, mise à jour mensuelle)'
            : isMixed
              ? 'Agrégation ADEME DPE v2 (mois disponibles) complétée par extrapolation déterministe sur les mois manquants'
              : 'Référentiel extrapolé KOVAS — baseline ADEME 2024 + croissance progressive saisonnalisée'
        }
        dataStatus={isLive ? 'live' : 'fallback'}
        periodLabel={periodLabel}
        axes={{ x: 'Mois (24 derniers mois glissants)', y: 'Nombre de rénovations engagées' }}
      />
    </Card>
  )
}
