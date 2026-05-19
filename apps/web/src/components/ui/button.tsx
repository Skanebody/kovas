import { cn } from '@/lib/utils'
import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-pill font-display font-medium whitespace-nowrap leading-none ' +
    'transition-all duration-fast ease-spring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy/20 ' +
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default:
          'bg-navy text-paper shadow-accent hover:bg-navy-deep hover:-translate-y-px',
        // v5 accent UNIQUE chartreuse — CTA fort signature (max 1/écran)
        accent:
          'bg-chartreuse text-ink shadow-[0_6px_18px_rgba(212,245,66,0.35)] hover:bg-chartreuse-deep hover:-translate-y-px',
        // Legacy v4 warm ambre — réservé alertes douces (coherence warnings)
        warm:
          'bg-amber text-paper shadow-warm hover:opacity-95 hover:-translate-y-px',
        glass:
          'bg-paper/85 text-ink border border-paper/70 shadow-sm backdrop-blur-md hover:bg-paper',
        outline:
          'bg-paper/85 text-ink border border-paper/70 shadow-sm backdrop-blur-md hover:bg-paper',
        ghost: 'text-ink-mute hover:text-ink hover:bg-ink/5',
        link: 'text-ink underline-offset-4 hover:underline rounded-none',
        destructive:
          'bg-danger text-paper shadow-[0_6px_18px_rgba(239,68,68,0.25)] hover:opacity-95',
      },
      size: {
        sm: 'px-3.5 py-1.5 text-[11px] min-h-[36px]',
        default: 'px-[22px] py-[11px] text-[13px] min-h-[44px]',
        lg: 'px-7 py-3.5 text-[15px] min-h-[48px]',
        icon: 'size-11 rounded-full min-h-[44px] min-w-[44px] p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size, className }))} {...props} />
    )
  },
)
Button.displayName = 'Button'

export { buttonVariants }
