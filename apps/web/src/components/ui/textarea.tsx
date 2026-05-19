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
          'flex min-h-20 w-full rounded-md border border-border bg-paper px-3 py-2 text-sm text-foreground transition-colors',
          'placeholder:text-ink-ghost',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-cta/10 focus-visible:border-cta',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    )
  },
)
Textarea.displayName = 'Textarea'
