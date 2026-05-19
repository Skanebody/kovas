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
          'flex h-11 w-full min-h-[44px] rounded-md border border-rule bg-paper px-4 py-2',
          'text-[13px] text-ink transition-all duration-fast ease-spring',
          'focus-visible:outline-none focus-visible:border-[1.5px] focus-visible:border-navy focus-visible:ring-[5px] focus-visible:ring-navy/10',
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
