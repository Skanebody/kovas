import { type VariantProps, cva } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-pill border px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-foreground text-background',
        outline: 'border-border text-foreground',
        muted: 'border-transparent bg-muted text-muted-foreground',
        // Accents délavés (cf. CLAUDE.md §9.3) — pills/badges seulement
        blue: 'border-transparent bg-accent-blue/15 text-accent-blue',
        green: 'border-transparent bg-accent-green/15 text-accent-green',
        red: 'border-transparent bg-accent-red/15 text-accent-red',
        orange: 'border-transparent bg-accent-orange/15 text-accent-orange',
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
