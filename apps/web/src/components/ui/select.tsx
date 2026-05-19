import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-md border border-border bg-paper px-3 py-2 text-sm text-foreground transition-colors',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cta/10 focus-visible:border-cta',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    )
  },
)
Select.displayName = 'Select'
