import { cn } from '@/lib/utils'
import { type VariantProps, cva } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

const dotVariants = cva('rounded-full shrink-0', {
  variants: {
    variant: {
      blue: 'size-2 bg-info shadow-[0_0_0_3px_rgba(59,130,246,0.20)]',
      amber: 'size-2 bg-warning shadow-[0_0_0_3px_rgba(245,158,11,0.20)] animate-pulse-soft',
      green: 'size-2 bg-success shadow-[0_0_0_3px_rgba(16,185,129,0.20)]',
      coral: 'size-2 bg-danger shadow-[0_0_0_3px_rgba(253,102,102,0.20)]',
      muted: 'size-2 bg-ink-ghost',
    },
  },
  defaultVariants: { variant: 'muted' },
})

export interface StatusPillProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof dotVariants> {
  label: string
  size?: 'sm' | 'default'
}

export function StatusPill({
  className,
  variant,
  label,
  size = 'default',
  ...props
}: StatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2.5 rounded-pill glass-opaque font-medium text-ink-soft',
        size === 'sm' ? 'px-2.5 py-1 text-[10px] gap-1.5' : 'px-4 py-2 text-[12px]',
        className,
      )}
      {...props}
    >
      <span className={cn(dotVariants({ variant }))} aria-hidden />
      {label}
    </span>
  )
}
