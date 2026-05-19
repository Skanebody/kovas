import { cn } from '@/lib/utils'
import { type VariantProps, cva } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

/**
 * Badge — pastilles pillule pour statuts, catégories, indicateurs.
 * KOVAS Design System v2 (2026-05-19) — 9 variants.
 *
 * Trois familles sémantiques :
 * 1. Neutres : default (CTA navy), outline (bordure), muted (gris atténué)
 * 2. Sémantiques DPE A-G + états :
 *    - green  → DPE A-C, success, validé, payé, exporté
 *    - yellow → DPE B-C légèrement énergivore, warning doux (butter Ron)
 *    - orange → DPE D-E, warning moyen
 *    - red    → DPE F-G, danger, impayé
 *    - blue   → info, mission planifiée, statut neutre
 * 3. Brand chaud nouveau v2 :
 *    - amber  → célébration, gain tracker, action positive saturée
 */
const badgeVariants = cva(
  'inline-flex items-center rounded-pill border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-cta text-cta-foreground',
        outline: 'border-border text-foreground bg-paper',
        muted: 'border-transparent bg-muted text-ink-mute',
        blue: 'border-transparent bg-accent-blue-soft text-accent-blue',
        green: 'border-transparent bg-accent-green-soft text-accent-green',
        red: 'border-transparent bg-accent-red-soft text-accent-red',
        orange: 'border-transparent bg-accent-orange-soft text-accent-orange',
        yellow: 'border-transparent bg-accent-yellow-soft text-foreground',
        amber: 'border-transparent bg-accent-warm-soft text-accent-warm',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
