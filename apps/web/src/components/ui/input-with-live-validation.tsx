'use client'

import { Input } from '@/components/ui/input'
import type { ValidationState } from '@/lib/smart-defaults/use-debounced-validation'
import { cn } from '@/lib/utils'
import { Check, Loader2, X } from 'lucide-react'
import { forwardRef } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'

interface InputWithLiveValidationProps extends InputHTMLAttributes<HTMLInputElement> {
  state: ValidationState
  message?: string
  /** Message complémentaire à afficher en succès (suggestion typo etc.). */
  hint?: ReactNode
}

/**
 * Input wrapper avec indicateur de validation live (check vert / cross rouge / spinner pending).
 * À combiner avec useDebouncedValidation pour le state.
 *
 * Affiche un message sous l'input :
 *  - rouge si state === 'invalid'
 *  - vert si state === 'valid' + hint fournie
 */
export const InputWithLiveValidation = forwardRef<HTMLInputElement, InputWithLiveValidationProps>(
  ({ state, message, hint, className, ...inputProps }, ref) => {
    const showIcon = state !== 'idle'
    return (
      <div className="space-y-1.5">
        <div className="relative">
          <Input
            ref={ref}
            {...inputProps}
            className={cn(
              showIcon && 'pr-9',
              state === 'invalid' &&
                'border-accent-red focus-visible:border-accent-red focus-visible:ring-accent-red/15',
              state === 'valid' && 'border-accent-green/60',
              className,
            )}
            aria-invalid={state === 'invalid' || undefined}
          />
          {state === 'pending' && (
            <Loader2
              aria-label="Validation en cours"
              className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-ink-mute"
            />
          )}
          {state === 'valid' && (
            <Check
              aria-label="Valide"
              className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-accent-green"
            />
          )}
          {state === 'invalid' && (
            <X
              aria-label="Invalide"
              className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-accent-red"
            />
          )}
        </div>
        {state === 'invalid' && message ? (
          <p className="text-[11px] text-accent-red" role="alert">
            {message}
          </p>
        ) : null}
        {state === 'valid' && hint ? <p className="text-[11px] text-accent-green">{hint}</p> : null}
      </div>
    )
  },
)
InputWithLiveValidation.displayName = 'InputWithLiveValidation'
