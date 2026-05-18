import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Label } from './label'

interface FormFieldProps extends HTMLAttributes<HTMLDivElement> {
  label?: string
  htmlFor?: string
  hint?: string
  error?: string
  required?: boolean
  children: ReactNode
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
  ...props
}: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)} {...props}>
      {label && (
        <Label htmlFor={htmlFor}>
          {label}
          {required && <span className="text-accent-red ml-0.5">*</span>}
        </Label>
      )}
      {children}
      {hint && !error && <p className="text-xs text-subtle-foreground">{hint}</p>}
      {error && (
        <p className="text-xs text-accent-red" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
