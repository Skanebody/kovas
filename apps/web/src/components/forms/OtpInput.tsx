'use client'

/**
 * KOVAS — OtpInput (Mission E3)
 * -----------------------------
 * 6 inputs numériques séparés, style "Apple-like".
 *
 * Comportement :
 *   - Auto-focus suivant à chaque digit saisi
 *   - Backspace : recule au précédent input
 *   - Flèches gauche/droite : navigation
 *   - Paste : colle 6 chiffres d'un coup
 *   - Auto-submit `onComplete` quand 6 chiffres saisis
 *   - Réinitialisation propre via prop `resetKey`
 *
 * Style : conforme Design System v5 (sage `#F5F7F4`, navy, chartreuse focus).
 * Pas d'emoji, pas d'animation gaming — sobre professionnel.
 */

import { cn } from '@/lib/utils'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

export interface OtpInputProps {
  /** Nombre de cellules. Default 6. */
  length?: number
  /** Auto-submit callback quand toutes les cellules sont remplies. */
  onComplete: (code: string) => void
  /** Optionnel : appelé à chaque changement. */
  onChange?: (partial: string) => void
  /** Si true → désactive tous les inputs (state 'submitting'). */
  disabled?: boolean
  /** Message d'erreur sous le champ (ex: "Code incorrect, 3 tentatives restantes"). */
  error?: string | null
  /** Change cette valeur pour reset le champ (ex: après "Renvoyer le code"). */
  resetKey?: string | number
  /** Label accessible. */
  ariaLabel?: string
  /** ID racine (pour aria-describedby). */
  id?: string
}

const ONLY_DIGITS = /^[0-9]$/

export function OtpInput({
  length = 6,
  onComplete,
  onChange,
  disabled = false,
  error,
  resetKey,
  ariaLabel = 'Code à 6 chiffres',
  id = 'otp-input',
}: OtpInputProps) {
  const [values, setValues] = useState<string[]>(() => Array.from({ length }, () => ''))
  const refs = useRef<Array<HTMLInputElement | null>>([])

  // Reset propre quand resetKey change
  useEffect(() => {
    setValues(Array.from({ length }, () => ''))
    refs.current[0]?.focus()
  }, [resetKey, length])

  const fullCode = useMemo(() => values.join(''), [values])

  const setValueAt = useCallback(
    (index: number, value: string) => {
      setValues((prev) => {
        const next = [...prev]
        next[index] = value
        const joined = next.join('')
        // Notifier onChange à chaque update (post-render)
        queueMicrotask(() => onChange?.(joined))
        // Auto-submit si toutes cellules remplies
        if (joined.length === length && !joined.includes('')) {
          queueMicrotask(() => onComplete(joined))
        }
        return next
      })
    },
    [length, onChange, onComplete],
  )

  const focusAt = useCallback((index: number) => {
    const target = refs.current[index]
    if (target) {
      target.focus()
      target.select()
    }
  }, [])

  const handleChange = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    // Si l'utilisateur tape 1 caractère
    if (raw.length === 1) {
      if (!ONLY_DIGITS.test(raw)) return
      setValueAt(index, raw)
      if (index < length - 1) {
        focusAt(index + 1)
      }
      return
    }
    // Si l'utilisateur supprime (raw vide)
    if (raw.length === 0) {
      setValueAt(index, '')
      return
    }
    // Si paste détecté via onChange (raw.length > 1)
    const digits = raw.replace(/\D/g, '').slice(0, length - index)
    if (digits.length === 0) return
    setValues((prev) => {
      const next = [...prev]
      for (let i = 0; i < digits.length; i++) {
        next[index + i] = digits[i] ?? ''
      }
      const joined = next.join('')
      queueMicrotask(() => onChange?.(joined))
      if (joined.length === length && !joined.includes('')) {
        queueMicrotask(() => onComplete(joined))
      }
      return next
    })
    const lastFilled = Math.min(index + digits.length, length - 1)
    focusAt(lastFilled)
  }

  const handleKeyDown = (index: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (values[index]) {
        // Vide la cellule courante
        setValueAt(index, '')
      } else if (index > 0) {
        // Recule
        focusAt(index - 1)
        setValueAt(index - 1, '')
      }
      e.preventDefault()
      return
    }
    if (e.key === 'ArrowLeft' && index > 0) {
      focusAt(index - 1)
      e.preventDefault()
      return
    }
    if (e.key === 'ArrowRight' && index < length - 1) {
      focusAt(index + 1)
      e.preventDefault()
      return
    }
  }

  const handlePaste = (index: number) => (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, length - index)
    if (pasted.length === 0) return
    e.preventDefault()
    setValues((prev) => {
      const next = [...prev]
      for (let i = 0; i < pasted.length; i++) {
        next[index + i] = pasted[i] ?? ''
      }
      const joined = next.join('')
      queueMicrotask(() => onChange?.(joined))
      if (joined.length === length && !joined.includes('')) {
        queueMicrotask(() => onComplete(joined))
      }
      return next
    })
    const lastFilled = Math.min(index + pasted.length, length - 1)
    focusAt(lastFilled)
  }

  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-label={ariaLabel}
        aria-describedby={error ? `${id}-error` : undefined}
        className="flex items-center justify-center gap-2 sm:gap-3"
      >
        {values.map((value, index) => (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="text"
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            pattern="[0-9]*"
            maxLength={index === 0 ? length : 1}
            value={value}
            disabled={disabled}
            onChange={handleChange(index)}
            onKeyDown={handleKeyDown(index)}
            onPaste={handlePaste(index)}
            onFocus={(e) => {
              e.currentTarget.select()
            }}
            aria-label={`Chiffre ${index + 1} sur ${length}`}
            className={cn(
              'h-14 w-12 sm:w-14 rounded-lg border bg-paper text-center font-mono',
              'text-2xl font-semibold text-ink',
              'transition-all duration-fast ease-spring',
              'focus-visible:outline-none focus-visible:border-[1.5px] focus-visible:border-navy focus-visible:ring-[5px] focus-visible:ring-navy/10',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error
                ? 'border-red-500 focus-visible:border-red-500 focus-visible:ring-red-500/10'
                : 'border-rule',
              fullCode.length === length && !error ? 'border-green-500' : '',
            )}
            data-index={index}
          />
        ))}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-center text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  )
}
