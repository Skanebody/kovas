import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Variant visuel (KOVAS Design System v2 — 2026-05-19).
   * - `flat` (défaut) : surface paper opaque + border + ombre douce neutre.
   *   Cards de travail (dashboard, dossier, listes, account).
   * - `glass` : opt-in pour surfaces flottantes au-dessus du flux
   *   (header sticky, sidebar, command palette, bottom sheets).
   * - `accent` : navy plein, hero visuels (GainTracker, milestones,
   *   CTA premium landing).
   * - `warm` : fond ambre-soft + bordure subtile. Sections d'alerte
   *   douce, mise en avant, cohérence à vérifier.
   */
  variant?: 'flat' | 'glass' | 'accent' | 'warm'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'flat', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        variant === 'flat' &&
          'rounded-xl border border-border-soft bg-paper text-foreground shadow-glass-sm',
        variant === 'glass' &&
          'rounded-xl border border-border-soft bg-paper/85 backdrop-blur-xl text-foreground shadow-glass',
        variant === 'accent' &&
          'rounded-2xl bg-card-accent text-card-accent-foreground shadow-accent',
        variant === 'warm' &&
          'rounded-xl border border-accent-warm/15 bg-accent-warm-soft text-foreground',
        className,
      )}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
  ),
)
CardHeader.displayName = 'CardHeader'

export const CardTitle = forwardRef<HTMLDivElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-lg font-bold leading-none tracking-tight', className)}
      {...props}
    />
  ),
)
CardTitle.displayName = 'CardTitle'

export const CardDescription = forwardRef<HTMLDivElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-ink-mute', className)} {...props} />
  ),
)
CardDescription.displayName = 'CardDescription'

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  ),
)
CardContent.displayName = 'CardContent'

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  ),
)
CardFooter.displayName = 'CardFooter'
