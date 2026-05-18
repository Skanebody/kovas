import { cn } from '@/lib/utils'

interface DonutProps {
  /** Valeur affichée au centre + déterminant la proportion (numerator) */
  value: number
  /** Dénominateur (total). Si omis, considère 100. */
  total?: number
  /** Label sous la valeur */
  label?: string
  /** Couleur du segment rempli — défaut : navy CTA */
  color?: 'navy' | 'blue' | 'green' | 'orange' | 'red'
  /** Diamètre extérieur en px */
  size?: number
  /** Épaisseur du donut en px */
  thickness?: number
  className?: string
}

const COLOR_MAP: Record<NonNullable<DonutProps['color']>, string> = {
  navy: 'hsl(var(--cta))',
  blue: 'hsl(var(--accent-blue))',
  green: 'hsl(var(--accent-green))',
  orange: 'hsl(var(--accent-orange))',
  red: 'hsl(var(--accent-red))',
}

/**
 * Donut statistique pur SVG, segments arrondis (linecap: round).
 * Pas de dépendance — cf. docs/design-system.md §2 (alternative recharts).
 */
export function Donut({
  value,
  total = 100,
  label,
  color = 'navy',
  size = 128,
  thickness = 12,
  className,
}: DonutProps) {
  const ratio = total > 0 ? Math.min(Math.max(value / total, 0), 1) : 0
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius
  const filled = circumference * ratio
  const empty = circumference - filled

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} role="img" aria-label={`${value} sur ${total}`}>
        {/* Track (segment vide) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={thickness}
          opacity={0.4}
        />
        {/* Segment rempli */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={COLOR_MAP[color]}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${empty}`}
          /* Démarre en haut au lieu de droite */
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tracking-tight tabular-nums">{value}</span>
        {label && (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">
            {label}
          </span>
        )}
      </div>
    </div>
  )
}
