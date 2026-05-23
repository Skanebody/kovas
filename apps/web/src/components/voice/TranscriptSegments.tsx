'use client'

/**
 * KOVAS — Affichage segments transcription avec confidence Whisper (MISSION-E niveau 3).
 *
 * Rend une transcription Whisper verbose_json segment par segment :
 *   - reliable  : texte normal
 *   - doubtful  : <span italic accent-warm> + icône warning + tooltip
 *   - inaudible : <span text-ink-faint> [inaudible — réécoutez] + bouton play inline
 *
 * Le bouton play déclenche un seek sur l'<audio> source (URL signée 1h) +
 * lecture 3s autour du segment (start-1, end+1).
 *
 * Si aucun audio source n'est fourni, le bouton play est masqué (mode read-only).
 *
 * Authority : MISSION-E niveau 3.
 */

import { cn } from '@/lib/utils'
import type { SegmentConfidence } from '@/lib/voice/segment-confidence'
import { AlertTriangle, Play } from 'lucide-react'
import { useRef, useState } from 'react'

export interface DisplaySegment {
  id: number
  text: string
  start: number
  end: number
  confidence: SegmentConfidence
}

interface TranscriptSegmentsProps {
  segments: DisplaySegment[]
  /** URL signée du blob audio source (1h TTL côté serveur). */
  audioUrl?: string | null
  className?: string
}

export function TranscriptSegments({
  segments,
  audioUrl,
  className,
}: TranscriptSegmentsProps): React.ReactElement {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playingId, setPlayingId] = useState<number | null>(null)

  function handleReplay(seg: DisplaySegment): void {
    const audio = audioRef.current
    if (!audio || !audioUrl) return
    // Joue les 3s autour du segment (1s avant → 1s après)
    const startAt = Math.max(0, seg.start - 1)
    const endAt = seg.end + 1
    try {
      audio.currentTime = startAt
      void audio.play()
      setPlayingId(seg.id)
      const stopHandler = (): void => {
        if (audio.currentTime >= endAt) {
          audio.pause()
          setPlayingId(null)
          audio.removeEventListener('timeupdate', stopHandler)
        }
      }
      audio.addEventListener('timeupdate', stopHandler)
    } catch {
      // Audio peut refuser de jouer (autoplay policy) — silencieux
      setPlayingId(null)
    }
  }

  return (
    <span className={cn('inline-flex flex-wrap gap-x-1 items-baseline', className)}>
      {audioUrl ? (
        // Audio caché pour le replay — controls=false suffit (élément invisible)
        // biome-ignore lint/a11y/useMediaCaption: audio source utilisateur (pas de caption disponible)
        <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
      ) : null}
      {segments.map((seg) => {
        const key = `seg-${seg.id}`
        if (seg.confidence === 'reliable') {
          return (
            <span key={key} className="text-ink">
              {seg.text}
            </span>
          )
        }
        if (seg.confidence === 'doubtful') {
          return (
            <span
              key={key}
              className="italic text-accent-warm inline-flex items-center gap-0.5"
              title="Transcription incertaine — vérifiez"
            >
              <AlertTriangle className="size-3 shrink-0" aria-hidden />
              {seg.text}
            </span>
          )
        }
        // inaudible
        return (
          <span key={key} className="inline-flex items-center gap-1 text-ink-faint">
            <span className="italic">[inaudible — réécoutez]</span>
            {audioUrl ? (
              <button
                type="button"
                onClick={() => handleReplay(seg)}
                className={cn(
                  'inline-flex size-5 items-center justify-center rounded-full',
                  'bg-paper border border-rule hover:bg-sage-alt',
                  'transition-colors',
                  playingId === seg.id ? 'border-accent-warm text-accent-warm' : 'text-ink-mute',
                )}
                aria-label={`Réécouter le segment de ${Math.round(seg.start)}s à ${Math.round(seg.end)}s`}
              >
                <Play className="size-2.5" aria-hidden />
              </button>
            ) : null}
          </span>
        )
      })}
    </span>
  )
}
