import { cn } from '@/lib/utils'
import type { ReactNode } from 'react'

type FormFieldProps = {
  label: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
  htmlFor?: string
  required?: boolean
}

/** Champ formulaire v3 — label 11px semibold + hint tiny. */
export function FormField({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
  required,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-[11px] font-semibold text-ink">
        {label}
        {required ? <span className="text-danger ml-0.5">*</span> : null}
      </label>
      {children}
      {hint && !error ? <p className="text-[11px] text-ink-faint">{hint}</p> : null}
      {error ? <p className="text-[11px] text-danger">{error}</p> : null}
    </div>
  )
}
