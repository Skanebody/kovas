'use client'

import { cn } from '@/lib/utils'
import { AlertCircle } from 'lucide-react'

interface ActionableErrorMessageProps {
  message: string
  action?: {
    label: string
    onClick?: () => void
    href?: string
  }
  className?: string
  /** Visuel : 'error' (rouge) ou 'warning' (ambre) ou 'info' (bleu). */
  tone?: 'error' | 'warning' | 'info'
}

/**
 * Message d'erreur avec suggestion d'action concrète.
 * Pattern : "Cet email est invalide. [Vérifier sur annuaire-entreprises.data.gouv.fr]"
 */
export function ActionableErrorMessage({
  message,
  action,
  className,
  tone = 'error',
}: ActionableErrorMessageProps) {
  const toneClasses = {
    error: 'border-accent-red/40 bg-accent-red/10 text-accent-red',
    warning: 'border-accent-yellow/40 bg-accent-yellow/10 text-ink',
    info: 'border-accent-blue/40 bg-accent-blue/10 text-ink',
  }[tone]

  return (
    <div
      className={cn('flex items-start gap-2 rounded-md border p-3 text-xs', toneClasses, className)}
      role="alert"
    >
      <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <p className="leading-snug">{message}</p>
        {action ? (
          action.href ? (
            <a
              href={action.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block underline font-medium hover:no-underline"
            >
              {action.label}
            </a>
          ) : action.onClick ? (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-block underline font-medium hover:no-underline"
            >
              {action.label}
            </button>
          ) : (
            <span className="font-medium">{action.label}</span>
          )
        ) : null}
      </div>
    </div>
  )
}
