import { cn } from '@/lib/utils'
import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

const buttonVariants = cva(
  // base — cf. CLAUDE.md §9 + docs/design-system.md (pillule CTA navy, hover lift)
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // CTA principal navy pillule + ombre + lift hover
        default:
          'bg-cta text-cta-foreground shadow-cta hover:bg-cta-hover hover:shadow-cta-hover hover:-translate-y-px',
        // Bordure navy 10% + bg blanc 80%
        outline:
          'border border-cta/10 bg-card/80 backdrop-blur-md text-foreground hover:bg-card hover:border-cta/20',
        // Sans fond, hover navy 5%
        ghost: 'text-foreground hover:bg-cta/5',
        link: 'text-foreground underline-offset-4 hover:underline rounded-none',
        // Card glass utility
        glass:
          'bg-card/80 backdrop-blur-xl text-foreground border border-cta/8 hover:bg-card hover:shadow-glass',
        // Destructive (rouge alerte)
        destructive:
          'bg-accent-red text-white shadow-badge-red hover:bg-accent-red/90 hover:-translate-y-px',
      },
      size: {
        default: 'h-10 px-6 py-2', // pillule classique
        sm: 'h-8 px-4 text-xs',
        lg: 'h-12 px-8 text-base',
        icon: 'size-10 rounded-full', // bouton circulaire action
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
