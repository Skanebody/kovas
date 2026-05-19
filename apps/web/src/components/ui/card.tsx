import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Variant visuel (cf. CLAUDE.md §9, décision P6 — 2026-05-19).
   * - `flat` (défaut) : surface paper opaque, ombre douce neutre. Cards
   *   de travail (dashboard, dossier, listes, account).
   * - `glass` : opt-in pour surfaces flottantes au-dessus du flux
   *   (rare dans le composant Card — la plupart des flottants utilisent
   *   directement les utilities `.glass-header` / `.glass-sidebar`).
   * - `accent` : cobalt pleine, hero visuels (CTA landing, gain tracker).
   */
  variant?: 'flat' | 'glass' | 'accent'
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'flat', ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        variant === 'flat' && 'rounded-2xl border border-border bg-card text-foreground shadow-glass',
        variant === 'glass' &&
          'rounded-2xl border border-cta/[0.08] bg-card/85 backdrop-blur-xl text-foreground shadow-glass',
        variant === 'accent' &&
          'rounded-2xl bg-card-accent text-card-accent-foreground shadow-accent',
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
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  ),
)
CardTitle.displayName = 'CardTitle'

export const CardDescription = forwardRef<HTMLDivElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
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
