import { cn } from '@/lib/utils'

/**
 * LinearProgress — Principe de fluidité #5 (V5).
 *
 * Barre de progression 1px navy en haut de l'écran. Remplace les spinners
 * pleins écran pour les chargements de navigation / opérations longues.
 *
 * Deux modes :
 * — Indéterminé (pas de `value`) : stripe animée infinie (`animate-progress-stripe`).
 * — Déterminé (`value` 0-100) : barre statique remplie au pourcentage.
 *
 * @example
 *   <LinearProgress />              // indéterminé, top-fixed
 *   <LinearProgress value={42} />   // 42% rempli
 *   <LinearProgress inline />       // rendu en flux (pas fixed)
 */

interface LinearProgressProps {
  /** Pourcentage 0-100. Indéterminé si absent. */
  value?: number
  /** Si true, ne se positionne pas en `fixed top-0`. */
  inline?: boolean
  /** Classes additionnelles. */
  className?: string
  /** Label accessible. Défaut "Chargement". */
  label?: string
}

export function LinearProgress({
  value,
  inline = false,
  className,
  label = 'Chargement',
}: LinearProgressProps) {
  const isDeterminate = typeof value === 'number'
  const clamped = isDeterminate
    ? Math.max(0, Math.min(100, value as number))
    : 0

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={isDeterminate ? clamped : undefined}
      className={cn(
        'h-px w-full overflow-hidden bg-navy/5',
        !inline && 'fixed inset-x-0 top-0 z-[200]',
        className,
      )}
    >
      {isDeterminate ? (
        <div
          className="h-full bg-navy transition-[width] duration-200 ease-out"
          style={{ width: `${clamped}%` }}
        />
      ) : (
        <div
          aria-hidden
          className={cn(
            'h-full w-full animate-progress-stripe',
            // Stripe navy 45° : alterne navy 100% et navy 5% pour effet glissant
            'bg-[linear-gradient(90deg,transparent_0%,hsl(var(--navy))_50%,transparent_100%)]',
            'bg-[length:33%_100%] bg-no-repeat',
          )}
          style={{ backgroundPositionX: '0%' }}
        />
      )}
    </div>
  )
}
