import { cn } from '@/lib/utils'
import type { HTMLAttributes } from 'react'

/**
 * SkeletonLoader — Principe de fluidité #5 (V5).
 *
 * Remplace les spinners pleins écran. Bandes navy 5% opacity avec animation
 * stripe (via `animate-progress-stripe`, token Tailwind défini globalement).
 *
 * Respect `prefers-reduced-motion` — l'animation est coupée par la règle
 * globale dans globals.css.
 *
 * @example
 *   <Skeleton variant="card" />
 *   <Skeleton variant="text" className="w-64" />
 */

type SkeletonVariant = 'text' | 'card' | 'avatar' | 'image' | 'line'

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant
  /** Nombre de lignes pour variant text/card. Défaut 1 (text), 3 (card). */
  lines?: number
}

const STRIPE_BG =
  'bg-[linear-gradient(45deg,hsl(var(--navy)/0.06)_25%,transparent_25%,transparent_50%,hsl(var(--navy)/0.06)_50%,hsl(var(--navy)/0.06)_75%,transparent_75%,transparent)] bg-[length:24px_24px]'

function SkeletonBar({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('rounded-md bg-navy/5 animate-progress-stripe', STRIPE_BG, className)}
      {...props}
    />
  )
}

export function Skeleton({ variant = 'text', lines, className, ...props }: SkeletonProps) {
  if (variant === 'avatar') {
    return <SkeletonBar className={cn('size-10 rounded-full', className)} {...props} />
  }
  if (variant === 'image') {
    return <SkeletonBar className={cn('w-full aspect-video rounded-lg', className)} {...props} />
  }
  if (variant === 'line') {
    return <SkeletonBar className={cn('h-1 w-full', className)} {...props} />
  }
  if (variant === 'card') {
    const count = lines ?? 3
    return (
      <div
        role="status"
        aria-label="Chargement en cours"
        className={cn('rounded-xl border border-rule bg-paper p-6 space-y-3', className)}
        {...props}
      >
        <SkeletonBar className="h-5 w-2/3" />
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonBar key={i} className={cn('h-3', i === count - 1 ? 'w-1/2' : 'w-full')} />
        ))}
      </div>
    )
  }
  // text
  const count = lines ?? 1
  if (count === 1) {
    return (
      <SkeletonBar
        role="status"
        aria-label="Chargement en cours"
        className={cn('h-4 w-full', className)}
        {...props}
      />
    )
  }
  return (
    <div
      role="status"
      aria-label="Chargement en cours"
      className={cn('space-y-2', className)}
      {...props}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBar key={i} className={cn('h-4', i === count - 1 ? 'w-3/4' : 'w-full')} />
      ))}
    </div>
  )
}
