import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Variant visuel (KOVAS Design System v3 — 2026-05-19, cf. PDF p.11).
   * - `opaque` (défaut, ex-flat v2) : paper translucide 85% sur fond cream,
   *   contenus denses, lisibilité prioritaire. Cards de travail dashboard,
   *   dossier, listes, account.
   * - `glass` : translucide cyan, micro-actions, hero visuels sur fond
   *   coloré. Pour surfaces flottantes (header sticky, sidebar, command
   *   palette, bottom sheets).
   * - `accent` : navy plein + glow ambre subtle, KPI hero dramatisé
   *   (GainTracker mode soir, CTA premium).
   * - `warm` : fond ambre-soft, alerte douce / mise en avant / cohérence
   *   à vérifier.
   */
  variant?: 'opaque' | 'glass' | 'accent' | 'warm' | 'flat'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'opaque', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // 'flat' = alias rétrocompat v2 vers 'opaque'
        (variant === 'opaque' || variant === 'flat') &&
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
