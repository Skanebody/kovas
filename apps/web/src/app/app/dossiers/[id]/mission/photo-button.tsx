'use client'

/**
 * KOVAS — Bouton photo géant du mode terrain Capture-First (V1.5 iteration 1).
 *
 * Pattern : `<input type="file" accept="image/*" capture="environment">` hidden,
 * déclenché au tap. Pas de `getUserMedia` pour cette itération — l'UA Mobile
 * ouvre l'app caméra native, ce qui maximise la qualité et la fiabilité.
 *
 * Le composant ne stocke rien : il remonte juste le `File` au parent qui se
 * chargera d'enqueuePhoto() dans une itération ultérieure.
 */

import { cn } from '@/lib/utils'
import { Camera } from 'lucide-react'
import { useRef } from 'react'

interface PhotoButtonProps {
  /** Premier tap (liste vide) → taille XL et microcopy plus longue. */
  variant?: 'default' | 'empty'
  /** Désactive le bouton (ex: pas de pièce sélectionnée). */
  disabled?: boolean
  onPhotoCaptured: (file: File) => void
}

export function PhotoButton({
  variant = 'default',
  disabled = false,
  onPhotoCaptured,
}: PhotoButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  function handleClick() {
    if (disabled) return
    inputRef.current?.click()
  }

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) {
      onPhotoCaptured(file)
    }
    // Reset pour permettre un re-tap sur la même photo en mode debug
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const isEmpty = variant === 'empty'

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={cn(
          'group relative flex items-center justify-center',
          'rounded-3xl transition-all duration-base ease-spring',
          'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-chartreuse/40',
          'disabled:cursor-not-allowed disabled:opacity-40',
          isEmpty
            ? 'size-[200px] border-2 border-dashed border-navy/30 bg-cream-deep/40'
            : 'size-[160px] border border-rule bg-paper shadow-md',
          'hover:-translate-y-px hover:border-navy/50 hover:shadow-lg',
          'active:translate-y-0 active:shadow-sm',
        )}
        aria-label="Capturer une photo"
      >
        <Camera
          className={cn(
            'text-navy transition-colors',
            isEmpty ? 'size-16' : 'size-12',
            'group-hover:text-navy-deep',
          )}
          aria-hidden
        />
      </button>

      <p
        className={cn(
          'max-w-xs text-center font-medium text-ink',
          isEmpty ? 'text-base' : 'text-sm text-ink-soft',
        )}
      >
        {isEmpty ? 'Tap pour capturer la première photo' : 'Tap pour capturer'}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={handleChange}
      />
    </div>
  )
}
