'use client'

/**
 * KOVAS — Modal d'enregistrement vocal court 30s post-photo (V1.5 iteration 4).
 *
 * Pipeline :
 *   1. user tape "Voix" dans PostPhotoActionBar
 *   2. modal full-screen avec waveform live + compteur
 *   3. user tape OK ou auto-stop à 30s
 *   4. enqueueVoiceNote(blob, attachedLocalPhotoId)
 *   5. sync manager upload → INSERT voice_notes → trigger /api/transcribe async
 *
 * Authority : CLAUDE.md §3 feature #1 (Whisper + parser hybride).
 */

import { Button } from '@/components/ui/button'
import { AudioRecorder } from '@/lib/audio-record'
import { enqueueVoiceNote } from '@/lib/mission/local-storage-queue'
import { cn } from '@/lib/utils'
import { Mic, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface VoiceRecorderModalProps {
  open: boolean
  localPhotoId: string
  /** Si la photo est déjà uploadée serveur, on peut shortcut le INSERT. */
  serverPhotoId?: string
  dossierId: string
  roomId: string | null
  thumbnailUrl?: string
  onCancel: () => void
  onComplete: (voiceLocalId: string) => void
}

const MAX_DURATION_SECONDS = 30
const SILENCE_PROMPT_MS = 5000

type Phase = 'starting' | 'recording' | 'finishing' | 'error'

export function VoiceRecorderModal({
  open,
  localPhotoId,
  serverPhotoId,
  dossierId,
  roomId,
  thumbnailUrl,
  onCancel,
  onComplete,
}: VoiceRecorderModalProps) {
  const [phase, setPhase] = useState<Phase>('starting')
  const [elapsed, setElapsed] = useState(0)
  const [silencePrompt, setSilencePrompt] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [waveform, setWaveform] = useState<number[]>(() => new Array(32).fill(0))

  const recorderRef = useRef<AudioRecorder | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const startTimestampRef = useRef<number>(0)
  const maxRmsRef = useRef<number>(0.05)
  const stoppedRef = useRef(false)

  const haptic = useCallback((ms: number) => {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(ms)
      } catch {
        // best-effort
      }
    }
  }, [])

  const cleanupAudioGraph = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    try {
      sourceNodeRef.current?.disconnect()
    } catch {
      /* noop */
    }
    sourceNodeRef.current = null
    analyserRef.current = null
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      void audioCtxRef.current.close()
    }
    audioCtxRef.current = null
  }, [])

  // ── Démarre l'enregistrement à l'ouverture ──────────────────────────
  useEffect(() => {
    if (!open) return
    let cancelled = false
    stoppedRef.current = false
    setPhase('starting')
    setError(null)
    setElapsed(0)
    setSilencePrompt(false)
    setWaveform(new Array(32).fill(0))

    const recorder = new AudioRecorder()
    recorderRef.current = recorder

    void (async () => {
      try {
        await recorder.start()
        if (cancelled) {
          recorder.cancel()
          return
        }
        setPhase('recording')
        startTimestampRef.current = Date.now()
        haptic(50)

        // Setup AudioContext + AnalyserNode pour la waveform live
        // On reuse le MediaStream du recorder via une astuce : malheureusement
        // AudioRecorder n'expose pas le stream, donc on récupère un nouveau
        // stream parallèle dédié à l'analyse (pas idéal, mais évite de refactor
        // audio-record.ts pour cette itération).
        try {
          const analyserStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          })
          // Si le composant a été unmount entre temps
          if (cancelled) {
            for (const t of analyserStream.getTracks()) t.stop()
            return
          }
          const ctx = new (
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          )()
          audioCtxRef.current = ctx
          const source = ctx.createMediaStreamSource(analyserStream)
          const analyser = ctx.createAnalyser()
          analyser.fftSize = 256
          source.connect(analyser)
          sourceNodeRef.current = source
          analyserRef.current = analyser
          // On stocke le stream pour cleanup
          analyserStreamRef.current = analyserStream
          tickWaveform()
        } catch (audioErr) {
          // Si l'analyseur échoue (Safari restrictif), on continue sans waveform.
          console.warn('[voice-recorder] analyser unavailable', audioErr)
        }
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Permission micro refusée'
        setError(msg)
        setPhase('error')
      }
    })()

    return () => {
      cancelled = true
      if (analyserStreamRef.current) {
        for (const t of analyserStreamRef.current.getTracks()) t.stop()
        analyserStreamRef.current = null
      }
      cleanupAudioGraph()
      if (!stoppedRef.current) {
        recorderRef.current?.cancel()
        recorderRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Stream auxiliaire pour l'AnalyserNode (workaround AudioRecorder ne l'expose pas).
  const analyserStreamRef = useRef<MediaStream | null>(null)

  // ── Boucle waveform 60fps ───────────────────────────────────────────
  const tickWaveform = useCallback(() => {
    if (!analyserRef.current) return
    const analyser = analyserRef.current
    const bufferLength = analyser.frequencyBinCount
    const data = new Uint8Array(bufferLength)

    const loop = () => {
      if (!analyserRef.current) return
      analyser.getByteFrequencyData(data)

      // Découpe en 32 buckets, moyenne par bucket
      const bars = new Array(32).fill(0) as number[]
      const bucketSize = Math.floor(bufferLength / 32)
      let totalRms = 0
      for (let i = 0; i < 32; i++) {
        let sum = 0
        for (let j = 0; j < bucketSize; j++) {
          sum += data[i * bucketSize + j] ?? 0
        }
        const avg = sum / bucketSize / 255 // 0..1
        bars[i] = avg
        totalRms += avg * avg
      }
      const rms = Math.sqrt(totalRms / 32)
      maxRmsRef.current = Math.max(maxRmsRef.current * 0.98, rms)
      setWaveform(bars)

      rafRef.current = window.requestAnimationFrame(loop)
    }
    loop()
  }, [])

  // ── Boucle compteur + auto-stop 30s ─────────────────────────────────
  useEffect(() => {
    if (phase !== 'recording') return
    const interval = setInterval(() => {
      const sec = (Date.now() - startTimestampRef.current) / 1000
      setElapsed(sec)
      if (!silencePrompt && Date.now() - startTimestampRef.current > SILENCE_PROMPT_MS) {
        // Si le max RMS est resté très bas, on suggère
        if (maxRmsRef.current < 0.04) {
          setSilencePrompt(true)
        }
      }
      if (sec >= MAX_DURATION_SECONDS) {
        void handleStop()
      }
    }, 200)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  // ── Stop OK ─────────────────────────────────────────────────────────
  async function handleStop() {
    if (stoppedRef.current) return
    stoppedRef.current = true
    setPhase('finishing')
    haptic(50)

    const recorder = recorderRef.current
    recorderRef.current = null
    if (!recorder) {
      onCancel()
      return
    }

    try {
      const rec = await recorder.stop()
      cleanupAudioGraph()
      if (analyserStreamRef.current) {
        for (const t of analyserStreamRef.current.getTracks()) t.stop()
        analyserStreamRef.current = null
      }

      const voiceLocalId = await enqueueVoiceNote({
        dossierId,
        roomId,
        blob: rec.blob,
        durationSeconds: rec.durationSeconds,
        mimeType: rec.mimeType,
        attachedLocalPhotoId: localPhotoId,
        attachedPhotoServerId: serverPhotoId ?? null,
      })
      onComplete(voiceLocalId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur enregistrement'
      setError(msg)
      setPhase('error')
    }
  }

  // ── Cancel ──────────────────────────────────────────────────────────
  function handleCancel() {
    if (stoppedRef.current) return
    stoppedRef.current = true
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder) recorder.cancel()
    cleanupAudioGraph()
    if (analyserStreamRef.current) {
      for (const t of analyserStreamRef.current.getTracks()) t.stop()
      analyserStreamRef.current = null
    }
    onCancel()
  }

  if (!open) return null

  const seconds = Math.floor(elapsed)
  const remaining = Math.max(0, MAX_DURATION_SECONDS - seconds)
  const counterLabel = `${pad(Math.floor(elapsed / 60))}:${pad(seconds % 60)}`
  const remainingLabel = `Reste ${remaining}s`

  return (
    // biome-ignore lint/a11y/useSemanticElements: pattern fixed+backdrop (pas <dialog>)
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Enregistrement vocal"
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-paper/95 backdrop-blur-sm',
        'animate-in fade-in duration-200',
      )}
    >
      {/* Thumbnail floutée en background */}
      {thumbnailUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnailUrl}
          alt=""
          aria-hidden
          className="pointer-events-none absolute inset-0 size-full object-cover opacity-20 blur-md"
        />
      ) : null}

      <div className="relative z-10 w-full max-w-md px-4">
        <div
          className={cn(
            'rounded-2xl border border-rule/80 bg-paper px-6 py-8',
            'shadow-xl',
            'flex flex-col items-center gap-6',
          )}
        >
          {phase === 'error' ? (
            <>
              <div className="flex flex-col items-center gap-2 text-center">
                <X className="size-10 text-accent-red" aria-hidden />
                <h2 className="font-serif text-xl italic text-ink">Impossible d'enregistrer</h2>
                <p className="text-sm text-ink-soft">{error}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="default" onClick={handleCancel}>
                  Fermer
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* Indicateur d'enregistrement */}
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-block size-3 rounded-full',
                    phase === 'recording' ? 'animate-pulse-soft bg-accent-red' : 'bg-ink-mute/30',
                  )}
                  aria-hidden
                />
                <span className="font-mono text-[11px] tracking-[0.08em] text-ink-mute uppercase">
                  {phase === 'starting'
                    ? 'Initialisation…'
                    : phase === 'finishing'
                      ? 'Sauvegarde…'
                      : 'Enregistrement'}
                </span>
              </div>

              {/* Compteur */}
              <div className="flex flex-col items-center gap-1">
                <span className="font-mono text-3xl sm:text-5xl font-semibold text-ink tabular-nums">
                  {counterLabel}
                </span>
                <span className="text-xs text-ink-mute">{remainingLabel}</span>
              </div>

              {/* Waveform canvas-like (barres) */}
              <Waveform bars={waveform} active={phase === 'recording'} />

              {/* Micro-copy si silence prolongé */}
              {silencePrompt && phase === 'recording' ? (
                <p className="text-center text-xs text-ink-soft">
                  Toujours là ? Vous pouvez parler.
                </p>
              ) : null}

              {/* Actions */}
              <div className="flex w-full items-center justify-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={handleCancel}
                  disabled={phase === 'finishing'}
                  className="gap-2"
                  aria-label="Annuler"
                >
                  <X className="size-5" aria-hidden />
                  Annuler
                </Button>
                <Button
                  type="button"
                  variant="accent"
                  size="lg"
                  onClick={handleStop}
                  disabled={phase !== 'recording'}
                  className="gap-2"
                  aria-label="Terminer l'enregistrement"
                >
                  <Mic className="size-5" aria-hidden />
                  Terminer
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Waveform visuel — 32 barres
// ============================================

interface WaveformProps {
  bars: number[]
  active: boolean
}

function Waveform({ bars, active }: WaveformProps) {
  return (
    <div className="flex h-16 w-full items-center justify-center gap-[2px]">
      {bars.map((v, i) => {
        const heightPct = Math.max(8, Math.min(100, v * 140))
        return (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: bars index stable (32 barres fixes)
            key={i}
            aria-hidden
            className={cn(
              'w-1.5 rounded-full transition-[height,background-color] duration-100',
              active ? 'bg-accent-red' : 'bg-ink-mute/40',
            )}
            style={{ height: `${heightPct}%` }}
          />
        )
      })}
    </div>
  )
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}
