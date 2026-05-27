import { cn } from '@/lib/utils'
import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

/**
 * Button — v5 canonique.
 *
 * RÈGLES D'USAGE CHARTREUSE (variant="accent", #D4F542) — STRICTES :
 *   ✅ AUTORISÉ uniquement pour :
 *     1. Badge "Actif" / "En direct" (pastille 8px)
 *     2. Underline tab actif (barre 2px)
 *     3. Validation IA confirmée (check, score IA élevé)
 *     4. CTA conversion principale (essai gratuit, signup payant)
 *     5. Dot notification 8px
 *   ❌ INTERDIT pour : fonds larges, textes permanents, bordures container,
 *      séparateurs, gradients, hover de boutons standards.
 *
 *   Une seule occurrence chartreuse visible par écran maximum (signature).
 *   Pour CTA secondaire / standard, utiliser variant="default" (navy)
 *   ou variant="warm" (ambre #D97706 célébration).
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-pill font-display font-medium whitespace-nowrap leading-none ' +
    'transition-all duration-fast ease-spring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-navy/20 ' +
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-navy text-paper shadow-accent hover:bg-navy-deep hover:-translate-y-px',
        // v5 accent UNIQUE chartreuse — CTA fort signature (max 1/écran)
        accent:
          'bg-chartreuse text-ink shadow-[0_6px_18px_rgba(212,245,66,0.35)] hover:bg-chartreuse-deep hover:-translate-y-px',
        // v5 : warm est désormais un alias de accent (chartreuse) — l'ambre
        // est réservé aux Card variant warm (coherence warnings) uniquement
        warm: 'bg-chartreuse text-ink shadow-[0_6px_18px_rgba(212,245,66,0.35)] hover:bg-chartreuse-deep hover:-translate-y-px',
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
