import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

export type InputProps = InputHTMLAttributes<HTMLInputElement>

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-md border border-cta/10 bg-card/80 px-3 py-2 text-sm text-foreground transition-colors',
          'placeholder:text-subtle-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta/25 focus-visible:border-cta/30',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
          className,
        )}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'
