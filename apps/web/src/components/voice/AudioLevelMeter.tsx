'use client'

/**
 * KOVAS — VU-mètre live anti-bruit (niveau 2 du pack MISSION-E).
 *
 * UI :
 *   - 5 segments LED horizontaux (gauche → droite) avec couleur dynamique selon RMS
 *   - Label statut sobre + micro-copy contextuelle :
 *       silent   : "Parlez maintenant"
 *       good     : "Audio propre"
 *       warning  : "Environnement bruyant — parlez plus fort ou rapprochez-vous d'un mur"
 *       critical : "Trop de bruit — recommencez quand possible" + bouton "Ignorer"
 *   - Vibration haptique iOS toutes les 1.5s en sustained critical
 *   - aria-live="polite" annonce "Audio bruité" pour les lecteurs d'écran
 *
 * Design system v5 strict :
 *   - good     → chartreuse #D4F542 (accent positif sage)
 *   - warning  → accent-warm #D97706 (ambre, pulse)
 *   - critical → accent-red (rouge, statique soutenu)
 *   - silent   → ink-mute/30 (gris désactivé)
 *
 * Performance :
 *   - Lecture snapshot via useAudioLevel (re-render max 10fps, anim CSS pure)
 *   - Cleanup AudioContext automatique au unmount du parent
 *   - Aucune dépendance NPM (Web Audio API native)
 *
 * Authority : MISSION-E niveau 2 (détectif).
 */

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { type AudioQuality, useAudioLevel } from '@/lib/voice/use-audio-level'
import { AlertTriangle } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface AudioLevelMeterProps {
  /** Stream micro actif. Null = meter en idle (pas d'analyse). */
  stream: MediaStream | null
  /** Si fourni, bouton "Ignorer" affiché en niveau critique soutenu. */
  onIgnoreCritical?: () => void
  /** Classe additionnelle wrapper (positionnement par le parent). */
  className?: string
  /** Désactive l'analyse même si le stream est présent (ex : pendant initialisation). */
  disabled?: boolean
}

// 5 segments — chacun s'allume au-dessus d'un seuil dB.
// Calibré pour : seg 1 = -40dB, seg 5 = -5dB (couverture utile voix terrain).
const SEGMENT_THRESHOLDS_DB = [-40, -30, -20, -12, -5] as const

const QUALITY_LABELS: Record<AudioQuality, string> = {
  silent: 'Parlez maintenant',
  good: 'Audio propre',
  warning: "Environnement bruyant — parlez plus fort ou rapprochez-vous d'un mur",
  critical: 'Trop de bruit — recommencez quand possible',
}

const QUALITY_ARIA: Record<AudioQuality, string> = {
  silent: '',
  good: '',
  warning: 'Environnement bruyant',
  critical: 'Audio fortement bruité',
}

export function AudioLevelMeter({
  stream,
  onIgnoreCritical,
  className,
  disabled = false,
}: AudioLevelMeterProps): React.ReactElement {
  const snapshot = useAudioLevel(stream, { enabled: !disabled })
  const lastVibrateRef = useRef<number>(0)

  // ── Vibration haptique iOS toutes les 1.5s en sustained critical ───────
  useEffect(() => {
    if (!snapshot.sustainedCritical) return
    if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return

    const interval = setInterval(() => {
      const now = performance.now()
      if (now - lastVibrateRef.current >= 1400) {
        try {
          navigator.vibrate(50)
        } catch {
          /* best-effort — vibration peut être bloquée par les settings */
        }
        lastVibrateRef.current = now
      }
    }, 500)
    return () => clearInterval(interval)
  }, [snapshot.sustainedCritical])

  // Combien de segments allumés selon le RMS courant
  let activeSegments = 0
  for (const threshold of SEGMENT_THRESHOLDS_DB) {
    if (snapshot.rmsDb >= threshold) activeSegments++
  }

  return (
    <fieldset
      className={cn('w-full flex flex-col items-center gap-1.5 border-0 p-0 m-0', className)}
      aria-label="Indicateur niveau audio"
    >
      {/* Barre LED 5 segments — sizing terrain (lisible en plein soleil) */}
      <div className="flex w-full max-w-xs items-center justify-center gap-1.5" aria-hidden="true">
        {SEGMENT_THRESHOLDS_DB.map((threshold, idx) => {
          const isActive = idx < activeSegments
          const segmentQuality = getSegmentQuality(idx)
          return (
            <span
              key={threshold}
              className={cn(
                'h-3 sm:h-4 flex-1 rounded-sm transition-[background-color,opacity] duration-100',
                isActive ? segmentClasses(segmentQuality) : 'bg-ink-mute/20',
                snapshot.quality === 'warning' && isActive && segmentQuality === 'warning'
                  ? 'animate-pulse-soft'
                  : '',
              )}
            />
          )
        })}
      </div>

      {/* Statut texte sobre */}
      <div
        className={cn(
          'flex items-center justify-center gap-1.5 text-center text-[11px] sm:text-xs',
          'font-medium leading-tight px-2',
          statusTextClasses(snapshot.quality),
        )}
        aria-live="polite"
        aria-atomic="true"
      >
        {snapshot.quality === 'critical' || snapshot.quality === 'warning' ? (
          <AlertTriangle className="size-3 shrink-0" aria-hidden />
        ) : null}
        <span>{QUALITY_LABELS[snapshot.quality]}</span>
      </div>

      {/* Annonce SR uniquement pour warning/critical (silencieuse en good/silent) */}
      {QUALITY_ARIA[snapshot.quality] ? (
        <output className="sr-only">{QUALITY_ARIA[snapshot.quality]}</output>
      ) : null}

      {/* Bouton "Ignorer" — affiché uniquement en critical soutenu si callback fourni */}
      {snapshot.sustainedCritical && onIgnoreCritical ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onIgnoreCritical}
          className="mt-1 h-7 px-3 text-[11px]"
        >
          Ignorer (urgent)
        </Button>
      ) : null}
    </fieldset>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers de mapping qualité → classes Tailwind (DS v5 strict)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Détermine la qualité associée à un segment donné.
 * Premier 3 segments = good (vert chartreuse).
 * Segment 4 = warning (ambre).
 * Segment 5 = critical (rouge).
 */
function getSegmentQuality(segmentIndex: number): AudioQuality {
  if (segmentIndex < 3) return 'good'
  if (segmentIndex < 4) return 'warning'
  return 'critical'
}

function segmentClasses(quality: AudioQuality): string {
  switch (quality) {
    case 'good':
      // Chartreuse v5 — accent positif (audio propre)
      return 'bg-chartreuse'
    case 'warning':
      return 'bg-accent-warm'
    case 'critical':
      return 'bg-accent-red'
    default:
      return 'bg-ink-mute/30'
  }
}

function statusTextClasses(quality: AudioQuality): string {
  switch (quality) {
    case 'good':
      return 'text-ink-soft'
    case 'warning':
      return 'text-accent-warm'
    case 'critical':
      return 'text-accent-red'
    default:
      return 'text-ink-mute'
  }
}
