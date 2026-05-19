import { cn } from '@/lib/utils'
import { type VariantProps, cva } from 'class-variance-authority'
import { forwardRef } from 'react'
import type { HTMLAttributes } from 'react'

/**
 * GlassCard — composant card glass canonique v4 (cf. docs/design/KOVAS_UIUX_App_Complete_v4.md §6.5).
 *
 * 4 variants d'opacité :
 * - `light`  : rgba(255,255,255,0.45) — overlays, tooltips
 * - `medium` : rgba(255,255,255,0.55) — cards intérieures, mission previews
 * - `strong` : rgba(255,255,255,0.72) — cards principales, sections (défaut)
 * - `dark`   : rgba(255,255,255,0.10) — éléments sur fond Drama navy
 *
 * 4 paddings : sm (16), md (24, défaut), lg (32), xl (40).
 *
 * Backdrop : blur(40px) saturate(180%) + -webkit fallback Safari iOS.
 * Border-radius : xl (28px) ou lg (22px). Border subtle. Inset highlight 1px.
 */
const glassCardVariants = cva(
  'relative rounded-xl border transition-all duration-base ease-spring',
  {
    variants: {
      variant: {
        light:
          'bg-white/45 border-white/40 [backdrop-filter:blur(40px)_saturate(180%)] [-webkit-backdrop-filter:blur(40px)_saturate(180%)] shadow-glass-sm',
        medium:
          'bg-white/55 border-white/40 [backdrop-filter:blur(40px)_saturate(180%)] [-webkit-backdrop-filter:blur(40px)_saturate(180%)] shadow-glass-sm',
        strong:
          'bg-white/[0.72] border-white/40 [backdrop-filter:blur(40px)_saturate(180%)] [-webkit-backdrop-filter:blur(40px)_saturate(180%)] shadow-glass',
        dark: 'bg-white/10 border-white/10 [backdrop-filter:blur(20px)_saturate(140%)] [-webkit-backdrop-filter:blur(20px)_saturate(140%)]',
      },
      padding: {
        none: '',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
        xl: 'p-10',
      },
      radius: {
        md: 'rounded-md',
        lg: 'rounded-lg',
        xl: 'rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'strong',
      padding: 'md',
      radius: 'xl',
    },
  },
)

export interface GlassCardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassCardVariants> {}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant, padding, radius, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(glassCardVariants({ variant, padding, radius }), className)}
      {...props}
    />
  ),
)
GlassCard.displayName = 'GlassCard'

export { glassCardVariants }
