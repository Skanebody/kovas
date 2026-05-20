'use client'

import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface LoadingViewProps {
  /** Message principal Instrument Serif italic. */
  message: string
  /** Sous-texte mono court optionnel (e.g. coût estimé, durée). */
  hint?: string
  className?: string
}

/**
 * Étape de chargement du flow Document Intelligence.
 * Spinner navy + message FR italique.
 */
export function LoadingView({ message, hint, className }: LoadingViewProps) {
  return (
    <output
      className={cn(
        'flex flex-col items-center justify-center gap-5 py-16 px-6 text-center',
        className,
      )}
      aria-live="polite"
    >
      <span
        aria-hidden
        className="flex size-16 items-center justify-center rounded-full bg-navy/10 text-navy"
      >
        <Loader2 className="size-7 animate-spin" strokeWidth={1.75} />
      </span>
      <h3 className="font-serif italic font-normal text-xl md:text-2xl text-ink max-w-md leading-tight">
        {message}
      </h3>
      {hint ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-mute">{hint}</p>
      ) : null}
    </output>
  )
}
