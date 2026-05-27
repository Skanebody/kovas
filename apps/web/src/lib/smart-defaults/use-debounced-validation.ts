'use client'

/**
 * useDebouncedValidation — exécute un validateur asynchrone avec debounce.
 *
 * Pattern :
 *  - state = 'idle' : valeur vide / pas encore touchée
 *  - state = 'pending' : debounce en cours OU validateur en cours
 *  - state = 'valid' : succès
 *  - state = 'invalid' : échec, `message` contient la raison
 */

import { useEffect, useRef, useState } from 'react'

export type ValidationState = 'idle' | 'pending' | 'valid' | 'invalid'

export interface ValidationResult {
  valid: boolean
  message?: string
  suggestion?: string
}

export interface UseDebouncedValidationResult {
  state: ValidationState
  message?: string
  suggestion?: string
}

export function useDebouncedValidation<T>(
  value: T,
  validator: (v: T) => Promise<ValidationResult> | ValidationResult,
  delayMs = 500,
): UseDebouncedValidationResult {
  const [result, setResult] = useState<UseDebouncedValidationResult>({ state: 'idle' })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const seqRef = useRef(0)

  useEffect(() => {
    const isEmpty =
      value === null || value === undefined || (typeof value === 'string' && value.trim() === '')

    if (isEmpty) {
      setResult({ state: 'idle' })
      if (timerRef.current) clearTimeout(timerRef.current)
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)
    setResult({ state: 'pending' })
    const seq = ++seqRef.current

    timerRef.current = setTimeout(async () => {
      try {
        const out = await validator(value)
        if (seq !== seqRef.current) return // une newer validation a démarré
        if (out.valid) {
          setResult({
            state: 'valid',
            ...(out.message ? { message: out.message } : {}),
            ...(out.suggestion ? { suggestion: out.suggestion } : {}),
          })
        } else {
          setResult({
            state: 'invalid',
            ...(out.message ? { message: out.message } : {}),
            ...(out.suggestion ? { suggestion: out.suggestion } : {}),
          })
        }
      } catch {
        if (seq !== seqRef.current) return
        setResult({ state: 'invalid', message: 'Validation impossible.' })
      }
    }, delayMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, delayMs])

  return result
}
