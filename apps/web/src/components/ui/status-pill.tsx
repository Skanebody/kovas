import { cn } from '@/lib/utils'
import { type VariantProps, cva } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

/**
 * StatusPill — pastille avec dot coloré pour les états vivants.
 * KOVAS Design System v2 (2026-05-19) — pattern Ron Design Lab.
 *
 * Différence vs Badge :
 * - Badge = état textuel statique (catégorie, type, label fixe)
 * - StatusPill = état vivant (mission en cours, planifiée, en attente)
 *   avec dot 8px coloré, halo ring soft, et pulse animation sur amber.
 *
 * Variants (signification métier) :
 * - blue   : programmé, planifié, à venir
 * - amber  : en cours (pulse 2s) — le seul variant animé
 * - green  : terminé, validé, exporté
 * - muted  : à démarrer, en attente, état neutre passif
 */
const dotVariants = cva('size-2 rounded-full shrink-0', {
  variants: {
    variant: {
      blue: 'bg-accent-blue ring-4 ring-accent-blue-soft',
      amber: 'bg-accent-warm ring-4 ring-accent-warm-soft animate-pulse-soft',
      green: 'bg-accent-green ring-4 ring-accent-green-soft',
      muted: 'bg-ink-ghost',
    },
  },
  defaultVariants: { variant: 'muted' },
})

export interface StatusPillProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof dotVariants> {
  /** Texte affiché à droite du dot */
  label: string
}

export function StatusPill({ className, variant, label, ...props }: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-pill border border-border-soft bg-paper px-3 py-1.5 text-sm font-medium text-foreground',
        className,
      )}
      {...props}
    >
      <span className={cn(dotVariants({ variant }))} />
      {label}
    </span>
  )
}
