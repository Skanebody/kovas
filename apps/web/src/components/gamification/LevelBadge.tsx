import { cn } from '@/lib/utils'
import { ringClassesFor, textClassesFor } from '@/lib/gamification/badges'
import { getLevelById, type LevelId } from '@/lib/gamification/levels'

export interface LevelBadgeProps {
  level: LevelId
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showLabel?: boolean
  className?: string
}

const SIZE_STYLES: Record<NonNullable<LevelBadgeProps['size']>, { box: string; dot: string; label: string }> = {
  sm: { box: 'h-6 w-6', dot: 'h-2 w-2', label: 'text-[10px] tracking-[0.06em]' },
  md: { box: 'h-8 w-8', dot: 'h-2.5 w-2.5', label: 'text-[11px] tracking-[0.08em]' },
  lg: { box: 'h-12 w-12', dot: 'h-3.5 w-3.5', label: 'text-[12px] tracking-[0.08em]' },
  xl: { box: 'h-16 w-16', dot: 'h-5 w-5', label: 'text-[14px] tracking-[0.1em]' },
}

/**
 * Pillule sobre indiquant un statut professionnel KOVAS.
 *
 * Format : cercle ringé en navy/chartreuse + libellé mono uppercase tracking-wide.
 * Strict respect du design system V5 — aucune couleur flashy ni gradient.
 */
export function LevelBadge({ level, size = 'md', showLabel = true, className }: LevelBadgeProps) {
  const def = getLevelById(level)
  if (!def) return null

  const styles = SIZE_STYLES[size]

  // Petit indicateur central : nombre de "dots" remplis selon l'id du niveau (1..7).
  // Sobre — 7 dots dans un cercle, les n premiers remplis.
  return (
    <div className={cn('inline-flex items-center gap-2.5', className)}>
      <div
        className={cn(
          'inline-flex items-center justify-center rounded-full',
          ringClassesFor(def),
          styles.box,
        )}
        aria-label={`Statut ${def.label}`}
      >
        <span
          className={cn(
            'rounded-full',
            styles.dot,
            def.iconColor === 'chartreuse-deep'
              ? 'bg-chartreuse-deep'
              : def.iconColor === 'chartreuse'
                ? 'bg-chartreuse'
                : def.iconColor === 'navy'
                  ? 'bg-navy'
                  : def.iconColor === 'ink-soft'
                    ? 'bg-ink-soft'
                    : 'bg-ink-mute',
          )}
        />
      </div>

      {showLabel ? (
        <span
          className={cn(
            'font-mono uppercase font-medium',
            styles.label,
            textClassesFor(def),
          )}
        >
          {def.label}
        </span>
      ) : null}
    </div>
  )
}
