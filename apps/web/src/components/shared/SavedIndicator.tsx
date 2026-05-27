'use client'

import type { AutoSaveStatus } from '@/hooks/useAutoSave'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

interface SavedIndicatorProps {
  status: AutoSaveStatus
  lastSavedAt: Date | null
  /** Callback "Réessayer" sur état error. */
  onRetry?: () => void
  className?: string
}

/**
 * SavedIndicator — Principe de fluidité #4 (V5).
 *
 * Indicateur d'état de sauvegarde discret en haut à droite des formulaires.
 * Typo mono opacity 40% (le user n'a normalement pas à y faire attention).
 *
 * États :
 * — idle : rien affiché (transparent)
 * — saving : "Sauvegarde…" + dot pulsé navy
 * — saved : "Enregistré HH:MM" mono 40% opacity
 * — error : "Erreur" rouge + bouton "Réessayer"
 *
 * À utiliser conjointement avec `useAutoSave`.
 *
 * @example
 *   const { status, lastSavedAt, retry } = useAutoSave(values, save)
 *   <SavedIndicator status={status} lastSavedAt={lastSavedAt} onRetry={retry} />
 */
export function SavedIndicator({ status, lastSavedAt, onRetry, className }: SavedIndicatorProps) {
  // Force re-render chaque minute pour "il y a X min"
  const [, setTick] = useState(0)
  useEffect(() => {
    if (status !== 'saved') return
    const t = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(t)
  }, [status])

  if (status === 'idle') {
    return (
      <span
        className={cn(
          'font-mono text-[11px] uppercase tracking-[0.06em] text-ink-mute/40',
          className,
        )}
        aria-live="polite"
      >
        {/* placeholder invisible mais réserve la place */}
        &nbsp;
      </span>
    )
  }

  if (status === 'saving') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-mute animate-pulse-soft',
          className,
        )}
        aria-live="polite"
        role="status"
      >
        <span aria-hidden className="size-1.5 rounded-full bg-navy/60" />
        Sauvegarde…
      </span>
    )
  }

  if (status === 'error') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em] text-danger',
          className,
        )}
        aria-live="assertive"
        role="alert"
      >
        <span aria-hidden className="size-1.5 rounded-full bg-danger" />
        Erreur
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="ml-1 underline decoration-danger/40 underline-offset-2 transition-colors duration-200 hover:decoration-danger focus-visible:decoration-danger"
          >
            Réessayer
          </button>
        )}
      </span>
    )
  }

  // status === 'saved'
  return (
    <span
      className={cn(
        'font-mono text-[11px] uppercase tracking-[0.06em] text-ink-mute/40',
        className,
      )}
      aria-live="polite"
      role="status"
    >
      Enregistré
      {lastSavedAt && ` · ${formatHM(lastSavedAt)}`}
    </span>
  )
}

function formatHM(d: Date): string {
  return d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  })
}
