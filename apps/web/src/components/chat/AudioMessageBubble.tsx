'use client'

/**
 * KOVAS — AudioMessageBubble : mini-player audio pour les bulles tchat mission.
 *
 * Pattern WhatsApp : bouton play/pause + barre de progression + durée.
 * Léger (HTML5 <audio> piloté en ref) — pas de dépendance externe.
 *
 * Usage :
 *   <AudioMessageBubble audioUrl={blobUrl} duration={12} variant="user" />
 *
 * Design system v5 strict :
 *   - variant user (bulle chartreuse) → contrôles ink, progression ink
 *   - variant assistant (bulle paper) → contrôles ink-soft, progression chartreuse-deep
 *
 * A11y :
 *   - bouton play/pause aria-label dynamique
 *   - role="progressbar" + aria-valuenow sur la barre
 *   - support clavier natif (Space sur le bouton)
 */

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Loader2, Pause, Play } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface AudioMessageBubbleProps {
  /** URL du blob audio (objectURL local OU signed URL Supabase Storage). */
  audioUrl: string
  /** Durée en secondes (affichée tant que l'audio n'est pas chargé). */
  duration: number
  /** Variante visuelle selon contexte de la bulle. */
  variant?: 'user' | 'assistant'
  /** Affiche un mini-spinner à côté du label durée (upload + transcription Whisper). */
  isTranscribing?: boolean
  /** Classe additionnelle pour positionnement. */
  className?: string
}

export function AudioMessageBubble({
  audioUrl,
  duration,
  variant = 'user',
  isTranscribing = false,
  className,
}: AudioMessageBubbleProps): React.ReactElement {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [loadedDuration, setLoadedDuration] = useState<number | null>(null)

  const effectiveDuration = loadedDuration ?? duration

  // ── Listeners audio element ────────────────────────────────────────
  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onTime = (): void => setCurrentTime(a.currentTime)
    const onLoaded = (): void => {
      if (Number.isFinite(a.duration) && a.duration > 0) {
        setLoadedDuration(a.duration)
      }
    }
    const onEnded = (): void => {
      setIsPlaying(false)
      setCurrentTime(0)
    }
    const onPause = (): void => setIsPlaying(false)
    const onPlay = (): void => setIsPlaying(true)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('loadedmetadata', onLoaded)
    a.addEventListener('ended', onEnded)
    a.addEventListener('pause', onPause)
    a.addEventListener('play', onPlay)
    return () => {
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('loadedmetadata', onLoaded)
      a.removeEventListener('ended', onEnded)
      a.removeEventListener('pause', onPause)
      a.removeEventListener('play', onPlay)
    }
  }, [])

  // ── Toggle play / pause ─────────────────────────────────────────────
  const [playError, setPlayError] = useState<string | null>(null)
  const handleToggle = useCallback(() => {
    const a = audioRef.current
    if (!a) {
      console.error('[AudioMessageBubble] audioRef.current is null')
      return
    }
    // Log debug : état audio + url avant tentative play
    console.debug('[AudioMessageBubble] toggle', {
      paused: a.paused,
      readyState: a.readyState,
      networkState: a.networkState,
      currentSrc: a.currentSrc,
      audioUrl,
      duration: a.duration,
      error: a.error?.code,
    })
    if (a.paused) {
      void a
        .play()
        .then(() => setPlayError(null))
        .catch((err: unknown) => {
          const msg =
            err instanceof Error ? `${err.name}: ${err.message}` : 'Erreur lecture inconnue'
          console.error('[AudioMessageBubble] play() failed', err, { audioUrl })
          setPlayError(msg)
          setIsPlaying(false)
        })
    } else {
      a.pause()
    }
  }, [audioUrl])

  // ── Click sur la barre de progression : seek ─────────────────────────
  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const a = audioRef.current
      if (!a) return
      const rect = e.currentTarget.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const target = pct * effectiveDuration
      a.currentTime = target
      setCurrentTime(target)
    },
    [effectiveDuration],
  )

  const progress = effectiveDuration > 0 ? Math.min(1, currentTime / effectiveDuration) : 0
  const remaining = Math.max(0, effectiveDuration - currentTime)
  const timeLabel = formatTime(isPlaying || currentTime > 0 ? remaining : effectiveDuration)

  // Couleurs selon variant (bulle user chartreuse → ink, bulle assistant paper → chartreuse-deep)
  const colors = {
    button:
      variant === 'user'
        ? 'bg-ink/15 hover:bg-ink/25 text-ink'
        : 'bg-chartreuse/20 hover:bg-chartreuse/30 text-chartreuse-deep',
    track: variant === 'user' ? 'bg-ink/15' : 'bg-ink-mute/20',
    fill: variant === 'user' ? 'bg-ink' : 'bg-chartreuse-deep',
    label: variant === 'user' ? 'text-ink/70' : 'text-ink-mute',
  } as const

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex items-center gap-2.5">
        {/* HTML5 audio caché — piloté en ref */}
        {/* biome-ignore lint/a11y/useMediaCaption: vocal terrain (auto-transcrit en dessous) */}
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          className="hidden"
          onError={(e) => {
            const a = e.currentTarget
            console.error('[AudioMessageBubble] <audio> error', {
              code: a.error?.code,
              message: a.error?.message,
              audioUrl,
              networkState: a.networkState,
              readyState: a.readyState,
            })
            setPlayError(
              a.error
                ? `Audio illisible (code ${a.error.code})`
                : 'Audio illisible (source invalide)',
            )
          }}
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleToggle}
          aria-label={isPlaying ? 'Mettre en pause' : 'Lire le message vocal'}
          className={cn('shrink-0 size-9 rounded-full', colors.button)}
        >
          {isPlaying ? (
            <Pause className="size-4" aria-hidden />
          ) : (
            <Play className="size-4 translate-x-[1px]" aria-hidden />
          )}
        </Button>

        {/* Barre de progression — bouton focusable pour respect a11y */}
        <button
          type="button"
          aria-label={`Position lecture ${Math.round(progress * 100)}%, cliquer pour changer`}
          onClick={handleSeek}
          onKeyDown={(e) => {
            // Flèches gauche/droite pour seek ±5%
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault()
              const audio = audioRef.current
              if (!audio || !audio.duration) return
              const delta = e.key === 'ArrowLeft' ? -0.05 : 0.05
              audio.currentTime = Math.max(
                0,
                Math.min(audio.duration, audio.currentTime + delta * audio.duration),
              )
            }
          }}
          className={cn(
            'group relative flex-1 h-7 flex items-center cursor-pointer text-left',
            'min-w-[100px] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-chartreuse/40',
          )}
        >
          <div className={cn('relative h-1 w-full rounded-full overflow-hidden', colors.track)}>
            <div
              className={cn(
                'absolute inset-y-0 left-0 transition-[width] duration-100',
                colors.fill,
              )}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </button>

        <span
          className={cn(
            'shrink-0 inline-flex items-center gap-1 font-mono text-[11px] tabular-nums',
            colors.label,
          )}
        >
          {timeLabel}
          {isTranscribing ? (
            <Loader2 className="size-3 animate-spin" aria-label="Transcription en cours" />
          ) : null}
        </span>
      </div>
      {playError ? (
        <p className={cn('text-[11px] font-mono px-1', 'text-accent-red')} role="alert">
          {playError}
        </p>
      ) : null}
    </div>
  )
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r < 10 ? '0' : ''}${r}`
}
