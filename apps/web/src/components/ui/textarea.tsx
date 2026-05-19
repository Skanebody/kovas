import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
import type { TextareaHTMLAttributes } from 'react'

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-[88px] w-full rounded-md border border-rule bg-paper px-4 py-3',
          'text-[13px] text-ink transition-all duration-fast ease-spring',
          'placeholder:text-ink-faint',
          'focus-visible:outline-none focus-visible:border-[1.5px] focus-visible:border-navy focus-visible:ring-[5px] focus-visible:ring-navy/10',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'
