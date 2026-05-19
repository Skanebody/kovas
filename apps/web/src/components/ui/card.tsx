import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef } from 'react'
import type { HTMLAttributes, CSSProperties } from 'react'

const cardVariants = cva('rounded-lg transition-all duration-base ease-spring', {
  variants: {
    variant: {
      opaque: 'glass-opaque text-ink',
      flat: 'glass-opaque text-ink',
      glass: 'glass text-ink',
      accent: 'bg-navy text-paper shadow-accent relative overflow-hidden',
      navy: 'bg-navy text-paper shadow-accent relative overflow-hidden',
      warm: 'border border-amber/20 shadow-md text-ink',
      dark: 'glass-dark text-paper',
    },
    padding: {
      none: '',
      sm: 'p-5',
      default: 'p-7',
      lg: 'p-9',
    },
  },
  defaultVariants: {
    variant: 'opaque',
    padding: 'default',
  },
})

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'opaque', padding, style, ...props }, ref) => {
    const resolved = variant === 'accent' ? 'navy' : variant
    const warmStyle: CSSProperties | undefined =
      resolved === 'warm'
        ? {
            background:
              'linear-gradient(135deg, rgba(255,213,168,0.80), rgba(255,200,150,0.65))',
          }
        : undefined

    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant: resolved, padding }), className)}
        style={{ ...warmStyle, ...style }}
        {...props}
      />
    )
  },
)
Card.displayName = 'Card'

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5', className)} {...props} />
  ),
)
CardHeader.displayName = 'CardHeader'

export const CardTitle = forwardRef<HTMLDivElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('text-[17px] font-semibold leading-tight tracking-tight text-ink', className)}
      {...props}
    />
  ),
)
CardTitle.displayName = 'CardTitle'

export const CardDescription = forwardRef<HTMLDivElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-[12px] text-ink-mute leading-normal', className)} {...props} />
  ),
)
CardDescription.displayName = 'CardDescription'

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('pt-0', className)} {...props} />
  ),
)
CardContent.displayName = 'CardContent'

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center pt-0', className)} {...props} />
  ),
)
CardFooter.displayName = 'CardFooter'
