import { cn } from '@/lib/utils'
import { type VariantProps, cva } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

const badgeVariants = cva(
  'inline-flex items-center rounded-pill border px-2.5 py-0.5 text-[11px] font-semibold font-display transition-colors duration-fast',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-navy text-paper',
        outline: 'border-rule text-ink bg-paper/80',
        muted: 'border-transparent bg-cream-deep text-ink-mute',
        blue: 'border-transparent bg-blue-mist text-[#1E3A8A]',
        green: 'border-transparent bg-lime-mist text-[#2D4015]',
        red: 'border-transparent bg-coral-mist text-[#8B1414]',
        orange: 'border-transparent bg-orange-mist text-[#7C3F0A]',
        yellow: 'border-transparent bg-orange-mist text-[#7C3F0A]',
        amber: 'border-transparent bg-orange-mist text-[#7C3F0A]',
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
