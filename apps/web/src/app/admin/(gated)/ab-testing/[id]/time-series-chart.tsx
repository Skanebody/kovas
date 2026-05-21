/**
 * Graphique évolution 30j — SVG pur (pas de dépendance Recharts ici)
 * pour rester simple côté admin V1.5. Affiche 2 lignes par variant :
 * exposures et conversions agrégées par jour.
 */

interface EventRow {
  event_type: string
  variant_assigned: string
  created_at: string
}

interface Props {
  events: EventRow[]
}

const VARIANT_COLORS: Record<string, string> = {
  control: '#0F1E3D',
  variant_a: '#D97706',
  variant_b: '#3B82F6',
  variant_c: '#059669',
}

export function TimeSeriesChart({ events }: Props) {
  if (!events.length) {
    return (
      <div className="py-10 text-center text-[12px] text-ink-mute italic">
        Pas d'événements sur les 30 derniers jours.
      </div>
    )
  }

  // Agrégation par jour × variant × eventType
  const byDay = new Map<string, Map<string, { exp: number; conv: number }>>()
  for (const e of events) {
    const day = e.created_at.slice(0, 10)
    if (!byDay.has(day)) byDay.set(day, new Map())
    const dayMap = byDay.get(day)
    if (!dayMap) continue
    if (!dayMap.has(e.variant_assigned)) dayMap.set(e.variant_assigned, { exp: 0, conv: 0 })
    const slot = dayMap.get(e.variant_assigned)
    if (!slot) continue
    if (e.event_type === 'exposure') slot.exp += 1
    else if (e.event_type === 'conversion') slot.conv += 1
  }

  const days = Array.from(byDay.keys()).sort()
  const variants = Array.from(new Set(events.map((e) => e.variant_assigned))).sort()

  // Scaling
  let maxValue = 1
  for (const day of days) {
    const dayMap = byDay.get(day)
    if (!dayMap) continue
    for (const v of variants) {
      const slot = dayMap.get(v)
      if (slot) maxValue = Math.max(maxValue, slot.exp, slot.conv)
    }
  }

  const width = 760
  const height = 240
  const padX = 36
  const padY = 24
  const innerW = width - padX * 2
  const innerH = height - padY * 2

  function pointsFor(variant: string, kind: 'exp' | 'conv'): string {
    return days
      .map((day, i) => {
        const dayMap = byDay.get(day)
        const slot = dayMap?.get(variant)
        const value = kind === 'exp' ? (slot?.exp ?? 0) : (slot?.conv ?? 0)
        const x = padX + (days.length === 1 ? innerW / 2 : (i / (days.length - 1)) * innerW)
        const y = padY + innerH - (value / maxValue) * innerH
        return `${x},${y}`
      })
      .join(' ')
  }

  return (
    <div className="space-y-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-auto"
        role="img"
        aria-label="Évolution exposures et conversions 30 jours"
      >
        {/* Axes */}
        <line
          x1={padX}
          y1={padY + innerH}
          x2={padX + innerW}
          y2={padY + innerH}
          stroke="currentColor"
          strokeOpacity={0.1}
        />
        <line
          x1={padX}
          y1={padY}
          x2={padX}
          y2={padY + innerH}
          stroke="currentColor"
          strokeOpacity={0.1}
        />
        {/* Label max */}
        <text
          x={padX - 6}
          y={padY + 4}
          fontSize={9}
          textAnchor="end"
          fill="currentColor"
          opacity={0.4}
          fontFamily="monospace"
        >
          {maxValue}
        </text>
        <text
          x={padX - 6}
          y={padY + innerH}
          fontSize={9}
          textAnchor="end"
          fill="currentColor"
          opacity={0.4}
          fontFamily="monospace"
        >
          0
        </text>

        {variants.map((v) => {
          const color = VARIANT_COLORS[v] ?? '#666666'
          return (
            <g key={v}>
              <polyline
                points={pointsFor(v, 'exp')}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeOpacity={0.55}
                strokeDasharray="4 3"
              />
              <polyline points={pointsFor(v, 'conv')} fill="none" stroke={color} strokeWidth={2} />
            </g>
          )
        })}
      </svg>
      <div className="flex flex-wrap gap-3 text-[10px] font-mono uppercase tracking-wider text-ink-mute">
        {variants.map((v) => (
          <span key={v} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block w-3 h-0.5 rounded-full"
              style={{ background: VARIANT_COLORS[v] ?? '#666666' }}
            />
            {v}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block w-3 border-b-2 border-dashed border-ink-mute" />
          exposures
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block w-3 h-0.5 rounded-full bg-ink-mute" />
          conversions
        </span>
      </div>
    </div>
  )
}
