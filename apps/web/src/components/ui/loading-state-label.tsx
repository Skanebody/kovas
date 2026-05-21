'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingStateLabelProps {
  state: 'idle' | 'loading'
  label: string
  className?: string
  /** Taille de l'icône en pixels (size-4 par défaut). */
  size?: 'sm' | 'md'
}

/**
 * Indicateur de chargement avec libellé contextuel.
 * Remplace les `<Loader2 className="animate-spin" />` orphelins.
 *
 * Affiche un spinner + un texte décrivant l'opération en cours.
 */
export function LoadingStateLabel({
  state,
  label,
  className,
  size = 'sm',
}: LoadingStateLabelProps) {
  if (state !== 'loading') return null
  const iconSize = size === 'md' ? 'size-5' : 'size-4'
  const textSize = size === 'md' ? 'text-sm' : 'text-xs'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-ink-mute',
        textSize,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className={cn(iconSize, 'animate-spin')} aria-hidden="true" />
      <span>{label}</span>
    </span>
  )
}
