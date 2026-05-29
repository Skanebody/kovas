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

  // ── Fallback Web Audio API (Safari ne sait pas décoder certains blobs MediaRecorder)
  // Si <audio> élément refuse la source (NotSupportedError), on tente le décodage via
  // AudioContext.decodeAudioData puis lecture via AudioBufferSourceNode. La signed
  // URL HTTP Whisper remplacera de toutes façons l'objectURL local quelques secondes
  // plus tard — c'est juste un patch UX pour la fenêtre où seul le blob local existe.
  const webAudioCtxRef = useRef<AudioContext | null>(null)
  const webAudioBufferRef = useRef<AudioBuffer | null>(null)
  const webAudioSourceRef = useRef<AudioBufferSourceNode | null>(null)
  const webAudioStartedAtRef = useRef<number>(0)
  const webAudioOffsetRef = useRef<number>(0)
  const timeRafRef = useRef<number | null>(null)
  const [useWebAudioFallback, setUseWebAudioFallback] = useState(false)
  const [webAudioFatal, setWebAudioFatal] = useState(false)

  const effectiveDuration = useWebAudioFallback
    ? (webAudioBufferRef.current?.duration ?? duration)
    : (loadedDuration ?? duration)

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

  // ── Cleanup Web Audio à l'unmount ──────────────────────────────────
  useEffect(() => {
    return () => {
      if (timeRafRef.current != null) cancelAnimationFrame(timeRafRef.current)
      try {
        webAudioSourceRef.current?.stop()
      } catch {
        /* déjà stoppé */
      }
      webAudioSourceRef.current?.disconnect()
      webAudioSourceRef.current = null
      void webAudioCtxRef.current?.close()
      webAudioCtxRef.current = null
    }
  }, [])

  // ── Reset les états quand l'URL change (swap blob:… → signed URL Whisper) ──
  // FIX (audit P1-4) : deps `[audioUrl]` (et non `[]`). Sans la dep, le reset ne
  // tournait qu'au montage → après le swap blob→signed URL, l'état
  // useWebAudioFallback restait collé sur l'ANCIENNE URL et le replay jouait/
  // échouait sur le blob périmé. On reset bien à chaque changement d'URL.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset volontaire sur changement d'URL uniquement
  useEffect(() => {
    // Si l'URL change après un fallback, on tente d'abord à nouveau le <audio>.
    setUseWebAudioFallback(false)
    setWebAudioFatal(false)
    setPlayError(null)
    setIsPlaying(false)
    setCurrentTime(0)
    webAudioBufferRef.current = null
    webAudioOffsetRef.current = 0
  }, [audioUrl])

  // ── Fallback : tente de décoder le blob via Web Audio API ───────────
  const tryWebAudioFallback = useCallback(async (): Promise<boolean> => {
    try {
      const AudioCtxCtor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioCtxCtor) return false
      const ctx = webAudioCtxRef.current ?? new AudioCtxCtor()
      webAudioCtxRef.current = ctx
      const res = await fetch(audioUrl)
      const buf = await res.arrayBuffer()
      const decoded = await ctx.decodeAudioData(buf.slice(0))
      webAudioBufferRef.current = decoded
      setUseWebAudioFallback(true)
      return true
    } catch (err) {
      console.warn('[AudioMessageBubble] Web Audio fallback failed', err)
      setWebAudioFatal(true)
      return false
    }
  }, [audioUrl])

  // ── Animation frame pour suivre currentTime en mode Web Audio ────────
  const tickWebAudio = useCallback(() => {
    const ctx = webAudioCtxRef.current
    if (!ctx || !webAudioBufferRef.current) return
    const elapsed = ctx.currentTime - webAudioStartedAtRef.current + webAudioOffsetRef.current
    const dur = webAudioBufferRef.current.duration
    if (elapsed >= dur) {
      setCurrentTime(dur)
      setIsPlaying(false)
      webAudioOffsetRef.current = 0
      return
    }
    setCurrentTime(elapsed)
    timeRafRef.current = requestAnimationFrame(tickWebAudio)
  }, [])

  // ── Lecture / pause Web Audio ────────────────────────────────────────
  const playWebAudio = useCallback(() => {
    const ctx = webAudioCtxRef.current
    const buffer = webAudioBufferRef.current
    if (!ctx || !buffer) return
    if (ctx.state === 'suspended') void ctx.resume()
    // PERF-5 : stop + disconnect la source précédente AVANT d'en créer une
    // nouvelle. Un double-tap play rapide créait un BufferSourceNode à chaque
    // appel sans libérer le précédent → accumulation de nœuds Web Audio (fuite
    // mémoire + lectures superposées). On nettoie en tête, idempotent.
    if (webAudioSourceRef.current) {
      // On détache d'abord l'`onended` de l'ancienne source : sinon le stop()
      // déclencherait son handler de fin qui remettrait isPlaying=false APRÈS
      // qu'on ait relancé la lecture (race async sur le double-tap).
      webAudioSourceRef.current.onended = null
      try {
        webAudioSourceRef.current.stop()
      } catch {
        /* déjà stoppé */
      }
      webAudioSourceRef.current.disconnect()
      webAudioSourceRef.current = null
    }
    if (timeRafRef.current != null) {
      cancelAnimationFrame(timeRafRef.current)
      timeRafRef.current = null
    }
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    src.onended = () => {
      // Distingue "fini" vs "stoppé manuellement" via offset
      if (webAudioOffsetRef.current === 0) {
        setIsPlaying(false)
        setCurrentTime(0)
      }
    }
    const startOffset = webAudioOffsetRef.current
    src.start(0, startOffset)
    webAudioSourceRef.current = src
    webAudioStartedAtRef.current = ctx.currentTime
    setIsPlaying(true)
    if (timeRafRef.current != null) cancelAnimationFrame(timeRafRef.current)
    timeRafRef.current = requestAnimationFrame(tickWebAudio)
  }, [tickWebAudio])

  const pauseWebAudio = useCallback(() => {
    const ctx = webAudioCtxRef.current
    if (!ctx) return
    const elapsed = ctx.currentTime - webAudioStartedAtRef.current + webAudioOffsetRef.current
    webAudioOffsetRef.current = elapsed
    try {
      webAudioSourceRef.current?.stop()
    } catch {
      /* déjà arrêté */
    }
    webAudioSourceRef.current?.disconnect()
    webAudioSourceRef.current = null
    if (timeRafRef.current != null) cancelAnimationFrame(timeRafRef.current)
    timeRafRef.current = null
    setIsPlaying(false)
  }, [])

  // ── Toggle play / pause ─────────────────────────────────────────────
  const [playError, setPlayError] = useState<string | null>(null)
  const handleToggle = useCallback(() => {
    // Mode fallback Web Audio actif
    if (useWebAudioFallback) {
      if (isPlaying) pauseWebAudio()
      else playWebAudio()
      return
    }
    const a = audioRef.current
    if (!a) {
      console.error('[AudioMessageBubble] audioRef.current is null')
      return
    }
    if (a.paused) {
      void a
        .play()
        .then(() => setPlayError(null))
        .catch((err: unknown) => {
          const name = err instanceof Error ? err.name : ''
          // NotSupportedError sur Safari = blob audio/mp4 que <audio> refuse.
          // On tente le fallback Web Audio API silencieusement.
          if (name === 'NotSupportedError' || name === 'NotAllowedError') {
            void tryWebAudioFallback().then((ok) => {
              if (ok) playWebAudio()
              else {
                setPlayError('Audio illisible — sera rejouable après analyse')
                setIsPlaying(false)
              }
            })
            return
          }
          const msg =
            err instanceof Error ? `${err.name}: ${err.message}` : 'Erreur lecture inconnue'
          console.error('[AudioMessageBubble] play() failed', err, { audioUrl })
          setPlayError(msg)
          setIsPlaying(false)
        })
    } else {
      a.pause()
    }
  }, [audioUrl, useWebAudioFallback, isPlaying, playWebAudio, pauseWebAudio, tryWebAudioFallback])

  // ── Click sur la barre de progression : seek ─────────────────────────
  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const target = pct * effectiveDuration
      if (useWebAudioFallback) {
        const wasPlaying = isPlaying
        if (wasPlaying) pauseWebAudio()
        webAudioOffsetRef.current = target
        setCurrentTime(target)
        if (wasPlaying) playWebAudio()
        return
      }
      const a = audioRef.current
      if (!a) return
      a.currentTime = target
      setCurrentTime(target)
    },
    [effectiveDuration, useWebAudioFallback, isPlaying, pauseWebAudio, playWebAudio],
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
            console.warn('[AudioMessageBubble] <audio> error → trying Web Audio fallback', {
              code: a.error?.code,
              audioUrl: audioUrl.slice(0, 60),
            })
            // Tente le décodage Web Audio API avant d'afficher une erreur.
            void tryWebAudioFallback().then((ok) => {
              if (!ok && !webAudioFatal) {
                setPlayError('Audio illisible — sera rejouable après analyse')
              } else {
                setPlayError(null)
              }
            })
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
        <p
          className={cn(
            'text-[11px] font-mono italic px-1',
            variant === 'user' ? 'text-ink/60' : 'text-ink-mute',
          )}
          role="alert"
        >
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
