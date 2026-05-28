'use client'

/**
 * KOVAS — Hook React useAudioLevel : analyse temps réel d'un MediaStream micro.
 *
 * Calcule :
 *   - RMS (Root Mean Square) en dB sur fenêtre glissante 200ms
 *   - SNR (Signal-to-Noise Ratio) estimé : peak - noise_floor (dB)
 *   - quality : 'good' | 'warning' | 'critical' selon seuils calibrés terrain
 *
 * Calibration seuils RMS (en dB) :
 *   - good     : -25 à -10 dB → voix claire à 30cm du micro
 *   - warning  : -10 à -5 dB  → voix forte OU bruit ambiant modéré
 *   - critical : > -5 dB constant > 2s → saturation ou bruit fort
 *   - silence  : < -45 dB → quasi-silence (utilisateur ne parle pas)
 *
 * Cleanup propre : ferme AudioContext + cancel rAF au unmount.
 *
 * Authority : MISSION-E niveau 2 (détectif).
 */

import { useEffect, useRef, useState } from 'react'

export type AudioQuality = 'silent' | 'good' | 'warning' | 'critical'

export interface AudioLevelSnapshot {
  /** Niveau RMS lissé en dB (~-60 silence … 0 saturation). */
  rmsDb: number
  /** SNR estimé en dB (peak - noise_floor). Plus haut = mieux. */
  snrDb: number
  /** Classification qualité pour UI/UX. */
  quality: AudioQuality
  /** Indique si on est en niveau critique soutenu > 2s (déclenche vibration). */
  sustainedCritical: boolean
}

interface UseAudioLevelOptions {
  /** Si false, le hook ne consomme aucune ressource (ne crée pas l'AudioContext). */
  enabled?: boolean
  /** Période de sustained critical avant flag (ms). Défaut 2000. */
  sustainedCriticalMs?: number
}

const DEFAULT_SNAPSHOT: AudioLevelSnapshot = {
  rmsDb: -60,
  snrDb: 0,
  quality: 'silent',
  sustainedCritical: false,
}

/** Convertit amplitude 0..1 en dB (clampé à -60). */
function amplitudeToDb(amp: number): number {
  if (amp <= 0) return -60
  const db = 20 * Math.log10(amp)
  return db < -60 ? -60 : db > 0 ? 0 : db
}

function classifyQuality(rmsDb: number): AudioQuality {
  if (rmsDb < -45) return 'silent'
  if (rmsDb < -10) return 'good'
  if (rmsDb < -5) return 'warning'
  return 'critical'
}

/**
 * Hook : branche un AnalyserNode sur le stream et expose un snapshot live à 30fps.
 *
 * Note perf : le state n'est mis à jour QUE toutes les ~100ms OU au changement
 * de `quality` / `sustainedCritical` (évite re-render à 60fps). Le rendu visuel
 * de la barre peut directement animer sur le snapshot reçu — la fréquence
 * d'update est largement suffisante pour l'œil.
 */
export function useAudioLevel(
  stream: MediaStream | null,
  options: UseAudioLevelOptions = {},
): AudioLevelSnapshot {
  const { enabled = true, sustainedCriticalMs = 2000 } = options

  const [snapshot, setSnapshot] = useState<AudioLevelSnapshot>(DEFAULT_SNAPSHOT)

  // Refs pour l'audio graph (cleanup propre).
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const rafRef = useRef<number | null>(null)
  // Refs de lissage / mesure (évite recalcul à chaque tick).
  const smoothedRmsRef = useRef<number>(-60)
  const peakRef = useRef<number>(-60)
  const noiseFloorRef = useRef<number>(-50)
  const criticalSinceRef = useRef<number | null>(null)
  const lastEmitRef = useRef<number>(0)
  const lastSnapshotRef = useRef<AudioLevelSnapshot>(DEFAULT_SNAPSHOT)

  useEffect(() => {
    if (!enabled || !stream) {
      lastSnapshotRef.current = DEFAULT_SNAPSHOT
      setSnapshot(DEFAULT_SNAPSHOT)
      return
    }

    let cancelled = false

    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!Ctx) {
      // Pas de WebAudio (très vieux navigateur) — on renvoie un snapshot stable.
      return
    }

    let ctx: AudioContext
    try {
      ctx = new Ctx()
    } catch {
      return
    }
    audioCtxRef.current = ctx
    // L'AudioContext peut démarrer "suspended" (autoplay policy) quand il n'est
    // pas créé directement dans un geste utilisateur (ici post-getUserMedia).
    // Sans resume(), getFloatTimeDomainData renvoie des zéros → VU-mètre figé à
    // "silence" alors que l'utilisateur parle (audit P2-3). resume() best-effort.
    if (ctx.state === 'suspended') void ctx.resume()

    let source: MediaStreamAudioSourceNode
    try {
      source = ctx.createMediaStreamSource(stream)
    } catch (err) {
      console.warn('[useAudioLevel] createMediaStreamSource failed', err)
      void ctx.close()
      audioCtxRef.current = null
      return
    }
    sourceRef.current = source

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 1024 // résolution suffisante pour RMS sans surcoût CPU
    analyser.smoothingTimeConstant = 0.3 // lissage doux côté analyser
    analyserRef.current = analyser
    source.connect(analyser)

    const timeData = new Float32Array(analyser.fftSize)

    const loop = (): void => {
      if (cancelled || !analyserRef.current) return
      analyser.getFloatTimeDomainData(timeData)

      // RMS instantané sur la fenêtre fftSize
      let sumSquares = 0
      for (let i = 0; i < timeData.length; i++) {
        const v = timeData[i]
        sumSquares += v * v
      }
      const rmsAmp = Math.sqrt(sumSquares / timeData.length)
      const rmsDbInstant = amplitudeToDb(rmsAmp)

      // Lissage exponentiel pour stabilité visuelle
      const alpha = 0.15
      smoothedRmsRef.current = smoothedRmsRef.current * (1 - alpha) + rmsDbInstant * alpha
      const rmsDb = smoothedRmsRef.current

      // Track peak (decay lent — révèle la dynamique vocale)
      peakRef.current = Math.max(peakRef.current * 0.998 + rmsDb * 0.002, rmsDb)

      // Track noise floor (decay rapide en descente, très lent en montée)
      if (rmsDb < noiseFloorRef.current) {
        noiseFloorRef.current = noiseFloorRef.current * 0.95 + rmsDb * 0.05
      } else {
        noiseFloorRef.current = noiseFloorRef.current * 0.999 + rmsDb * 0.001
      }
      const snrDb = peakRef.current - noiseFloorRef.current
      const quality = classifyQuality(rmsDb)

      // Sustained critical : track depuis quand on est en critical
      const now = performance.now()
      if (quality === 'critical') {
        if (criticalSinceRef.current === null) criticalSinceRef.current = now
      } else {
        criticalSinceRef.current = null
      }
      const sustainedCritical =
        criticalSinceRef.current !== null && now - criticalSinceRef.current >= sustainedCriticalMs

      // Emit state toutes les ~100ms ou sur changement qualité (anti-spam re-render)
      const shouldEmit =
        now - lastEmitRef.current > 100 ||
        quality !== lastSnapshotRef.current.quality ||
        sustainedCritical !== lastSnapshotRef.current.sustainedCritical
      if (shouldEmit) {
        const next: AudioLevelSnapshot = { rmsDb, snrDb, quality, sustainedCritical }
        lastSnapshotRef.current = next
        setSnapshot(next)
        lastEmitRef.current = now
      }

      rafRef.current = window.requestAnimationFrame(loop)
    }

    loop()

    return () => {
      cancelled = true
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      try {
        sourceRef.current?.disconnect()
      } catch {
        /* track déjà stoppée */
      }
      sourceRef.current = null
      analyserRef.current = null
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close()
      }
      audioCtxRef.current = null
      // Reset compteurs pour le prochain mount
      smoothedRmsRef.current = -60
      peakRef.current = -60
      noiseFloorRef.current = -50
      criticalSinceRef.current = null
      lastEmitRef.current = 0
      lastSnapshotRef.current = DEFAULT_SNAPSHOT
    }
  }, [stream, enabled, sustainedCriticalMs])

  return snapshot
}
