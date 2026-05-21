import { Card } from '@/components/ui/card'

export interface TrendsPoint {
  /** Label court mois "janv.", "févr."… */
  label: string
  /** Heures gagnées dans le mois. */
  hoursSaved: number
  /** CA HT du mois en euros. */
  revenueEur: number
}

interface TrendsLineChartProps {
  /** Série de 12 points (12 derniers mois, ordre chronologique). */
  data: TrendsPoint[]
}

/**
 * Card "Tendances" — 2 lignes superposées sur 12 mois.
 *
 * SVG custom (pas de dépendance recharts), DS v5 sobre :
 *  - Ligne #1 : heures gagnées (noir #0F1419, axe gauche)
 *  - Ligne #2 : CA HT (chartreuse #A3C920 deep, axe droit implicite)
 *  - Pas d'aplats remplis : juste deux strokes 1.5px arrondis
 *  - Grille horizontale 3 lignes pointillées discrètes (rule/40)
 *  - Labels mois en mono 10px en bas
 *  - Légende minimale au-dessus
 *
 * Note : pas d'hover/tooltip interactif (chart server-rendered SVG). Pour
 * interactivité avancée, prévoir un wrapper client futur — hors scope P5.
 */
export function TrendsLineChart({ data }: TrendsLineChartProps) {
  const width = 720
  const height = 240
  const padX = 36
  const padY = 24
  const innerW = width - padX * 2
  const innerH = height - padY * 2

  // Normalisations indépendantes (deux échelles distinctes superposées).
  const maxHours = Math.max(...data.map((p) => p.hoursSaved), 1)
  const maxRevenue = Math.max(...data.map((p) => p.revenueEur), 1)

  const step = data.length > 1 ? innerW / (data.length - 1) : innerW

  const pathHours = data
    .map((p, i) => {
      const x = padX + i * step
      const y = padY + innerH - (p.hoursSaved / maxHours) * innerH
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  const pathRevenue = data
    .map((p, i) => {
      const x = padX + i * step
      const y = padY + innerH - (p.revenueEur / maxRevenue) * innerH
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  // 3 lignes de grille (25/50/75% de la hauteur)
  const gridLines = [0.25, 0.5, 0.75].map((r) => padY + innerH * r)

  // Total cumulé pour le sous-titre
  const totalHours = data.reduce((s, p) => s + p.hoursSaved, 0)
  const totalRevenue = data.reduce((s, p) => s + p.revenueEur, 0)

  return (
    <Card variant="opaque" padding="none" className="rounded-[24px] overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 flex-wrap border-b border-rule/60 px-6 py-4">
        <div className="space-y-0.5">
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink-mute">
            Tendances · 12 mois
          </p>
          <p className="font-serif italic text-2xl text-ink leading-tight">
            Évolution heures gagnées & revenus
          </p>
        </div>
        <div className="font-mono text-[10px] text-ink-mute/90 tracking-[0.05em] tabular-nums text-right space-y-0.5">
          <p>
            <span className="inline-block size-2 rounded-full bg-[#0F1419] mr-1.5 align-middle" />
            {Math.round(totalHours).toLocaleString('fr-FR')}h cumulées
          </p>
          <p>
            <span className="inline-block size-2 rounded-full bg-chartreuse-deep mr-1.5 align-middle" />
            {Math.round(totalRevenue).toLocaleString('fr-FR')} € HT cumulés
          </p>
        </div>
      </div>

      <div className="px-2 sm:px-6 py-6">
        <svg
          viewBox={`0 0 ${width} ${height + 28}`}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-auto"
          role="img"
          aria-label="Graphique d'évolution heures gagnées et revenus sur 12 mois"
        >
          {/* Grille horizontale */}
          {gridLines.map((y) => (
            <line
              key={y}
              x1={padX}
              x2={width - padX}
              y1={y}
              y2={y}
              stroke="hsl(var(--border) / 0.5)"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          ))}

          {/* Ligne CA (background, plus discrète) */}
          <path
            d={pathRevenue}
            fill="none"
            stroke="#A3C920"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.8}
          />

          {/* Ligne Heures (foreground, dominante) */}
          <path
            d={pathHours}
            fill="none"
            stroke="#0F1419"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Points sur la ligne heures (subtile) */}
          {data.map((p, i) => {
            const x = padX + i * step
            const y = padY + innerH - (p.hoursSaved / maxHours) * innerH
            return (
              <circle
                key={`h-${p.label}-${i}`}
                cx={x}
                cy={y}
                r={2.5}
                fill="#0F1419"
              />
            )
          })}

          {/* Labels mois en bas */}
          {data.map((p, i) => {
            const x = padX + i * step
            return (
              <text
                key={`l-${p.label}-${i}`}
                x={x}
                y={height + 16}
                fontSize={10}
                fill="hsl(var(--ink-mute, var(--foreground)) / 0.7)"
                textAnchor="middle"
                fontFamily="var(--font-mono), monospace"
              >
                {p.label}
              </text>
            )
          })}
        </svg>
      </div>
    </Card>
  )
}
