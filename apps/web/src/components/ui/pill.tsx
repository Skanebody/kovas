'use client'

import { cn } from '@/lib/utils'
import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

/**
 * Pill — composant CTA canonique v4 (cf. docs/design/KOVAS_UIUX_App_Complete_v4.md §3).
 *
 * 5 variants stricts :
 * - `primary` : navy plein, ombre — CTA principal (UN SEUL par écran)
 * - `amber`   : ambre #F59E0B — énergie positive (MAX UN par écran)
 * - `glass`   : blanc translucide blur — sur fonds colorés Drama
 * - `ghost`   : transparent, hover bg-glass — actions secondaires
 * - `danger`  : coral — suppressions, alertes
 *
 * 3 sizes : sm (h-7), md (h-9, défaut), lg (h-11).
 * Tous en `rounded-pill` (999px). Urbanist 600.
 *
 * Spec : §6.4 du doc v4 canonique.
 */
const pillVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-pill font-semibold transition-all duration-fast ease-spring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy-800/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary:
          'bg-navy-800 text-white shadow-cta hover:bg-navy-700 hover:-translate-y-px hover:shadow-cta-hover active:translate-y-0',
        amber:
          'bg-amber text-white shadow-warm hover:bg-amber/90 hover:-translate-y-px active:translate-y-0',
        glass:
          'bg-white/55 backdrop-blur-xl border border-white/40 text-navy-900 hover:bg-white/75 hover:border-white/60',
        ghost:
          'bg-transparent text-ink-mute hover:bg-white/55 hover:text-navy-900 hover:backdrop-blur-md',
        danger:
          'bg-danger text-white hover:bg-danger/90 hover:-translate-y-px active:translate-y-0',
      },
      size: {
        sm: 'h-7 px-3 text-xs',
        md: 'h-9 px-5 text-sm',
        lg: 'h-11 px-7 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export interface PillProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof pillVariants> {
  asChild?: boolean
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
}

export const Pill = forwardRef<HTMLButtonElement, PillProps>(
  (
    {
      className,
      variant,
      size,
      asChild = false,
      loading = false,
      disabled,
      icon,
      iconRight,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        ref={ref}
        className={cn(pillVariants({ variant, size }), className)}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" /> : icon}
        {children}
        {!loading && iconRight}
      </Comp>
    )
  },
)
Pill.displayName = 'Pill'

export { pillVariants }
