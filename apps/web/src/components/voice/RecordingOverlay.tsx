'use client'

/**
 * KOVAS — RecordingOverlay : bandeau full-width au-dessus du composer tchat.
 *
 * Affiché pendant l'enregistrement vocal terrain (mode mission).
 * Pattern WhatsApp adapté ton SOBRE PROFESSIONNEL (avatar 43 ans ex-cadre).
 *
 * Contenu :
 *   - Indicateur rouge pulsant à gauche (dot 8px + halo)
 *   - Timer JetBrains Mono `00:23` (incrémente chaque seconde)
 *   - VU-mètre 5 segments au centre (réutilise AudioLevelMeter)
 *   - Zone hint à droite :
 *       mode press-hold normal : "← Glisser pour annuler" (text-ink-mute)
 *       mode press-hold cancel zone : "Relâcher pour annuler" (text-accent-red + pulse)
 *       mode tap-toggle : bouton Stop visible (rendu par le parent — overlay reste compact)
 *
 * Authority : MISSION-E (anti-bruit) + design v5 strict.
 */

import { AudioLevelMeter } from '@/components/voice/AudioLevelMeter'
import { cn } from '@/lib/utils'
import { useEffect, useState } from 'react'

export type RecordingMode = 'idle' | 'tap-toggle' | 'press-hold' | 'press-hold-cancel'

export interface RecordingOverlayProps {
  /** Mode courant — pilote le hint affiché à droite. */
  mode: RecordingMode
  /** Stream micro actif pour le VU-mètre (peut être null si pas encore initialisé). */
  meterStream: MediaStream | null
  /** Timestamp ms du démarrage enregistrement (pour calcul du timer). */
  startedAt: number
  /** Classe additionnelle wrapper. */
  className?: string
}

export function RecordingOverlay({
  mode,
  meterStream,
  startedAt,
  className,
}: RecordingOverlayProps): React.ReactElement {
  const [elapsed, setElapsed] = useState(0)

  // ── Tick timer chaque 250ms (suffisant pour affichage à la seconde) ──
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    }, 250)
    return () => clearInterval(interval)
  }, [startedAt])

  const inCancelZone = mode === 'press-hold-cancel'
  const isPressHold = mode === 'press-hold' || mode === 'press-hold-cancel'

  return (
    <output
      aria-label="Enregistrement vocal en cours"
      aria-live="polite"
      className={cn(
        'flex items-center gap-3 px-3 sm:px-4 py-2',
        'rounded-2xl border bg-paper shadow-glass-sm',
        inCancelZone ? 'border-accent-red/40 bg-accent-red/5' : 'border-rule/60',
        'transition-colors duration-150',
        'animate-in fade-in slide-in-from-bottom-1 duration-200',
        className,
      )}
    >
      {/* Dot rouge pulsant + timer */}
      <div className="flex items-center gap-2 shrink-0">
        <span
          aria-hidden
          className={cn(
            'relative inline-block size-2.5 rounded-full',
            inCancelZone ? 'bg-accent-red' : 'bg-accent-red',
            'before:absolute before:inset-0 before:rounded-full before:bg-accent-red/50',
            'before:animate-ping',
          )}
        />
        <span
          className={cn(
            'font-mono text-[13px] sm:text-[14px] font-semibold tabular-nums',
            inCancelZone ? 'text-accent-red' : 'text-ink',
          )}
        >
          {formatTimer(elapsed)}
        </span>
      </div>

      {/* VU-mètre au centre (caché si pas de stream) */}
      <div className="flex-1 min-w-0 flex justify-center">
        {meterStream ? (
          <AudioLevelMeter stream={meterStream} className="!gap-1" />
        ) : (
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
            Initialisation micro…
          </span>
        )}
      </div>

      {/* Hint à droite — uniquement en press-hold (le bouton Stop est rendu par le parent en tap) */}
      {isPressHold ? (
        <div className="shrink-0 flex items-center">
          <span
            aria-live="polite"
            className={cn(
              'text-[11px] sm:text-[12px] font-medium',
              inCancelZone ? 'text-accent-red animate-pulse-soft' : 'text-ink-mute',
            )}
          >
            {inCancelZone ? 'Relâcher pour annuler' : '← Glisser pour annuler'}
          </span>
        </div>
      ) : (
        <div className="shrink-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-mute">
            Tap micro pour arrêter
          </span>
        </div>
      )}
    </output>
  )
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`
}
