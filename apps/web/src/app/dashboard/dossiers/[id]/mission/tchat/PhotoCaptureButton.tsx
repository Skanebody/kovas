'use client'

/**
 * KOVAS — Mode mission tchat : bouton capture photo rafale (MISSION-B).
 *
 * Refonte du bouton camera basique (FIX-MM) — ajoute :
 *  - Tap court     = 1 photo (input file capture=environment)
 *  - Long press    = rafale 1 photo / 500ms tant que pressé (cap 20)
 *  - Compression   = JPEG q=0.8 max 1920px ~250KB (canvas.toBlob)
 *  - Thumbnail     = 200×200 base64 (~12KB) pour preview chat
 *  - GPS           = navigator.geolocation.getCurrentPosition cached 5min
 *  - Métadonnées   = taken_at, lat/lng, accuracy, orientation
 *  - Offline       = écriture immédiate IndexedDB (Dexie) — sync au retour réseau
 *  - Vibration     = navigator.vibrate(50) à chaque photo (haptic feedback)
 *  - A11y          = aria-label dynamique selon mode, role="button"
 *
 * Authority : CLAUDE.md §3 features 2 (photos géolocalisées) + 10 (offline).
 */

import { compressImage } from '@/lib/mission/photo-processor'
import {
  type DeviceOrientation,
  type PendingPhotoMetadata,
  addPhoto,
} from '@/lib/mission/photos-offline-store'
import { photosSyncManager } from '@/lib/mission/photos-sync-manager'
import { cn } from '@/lib/utils'
import { Camera } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface PhotoCaptureButtonProps {
  dossierId: string
  missionSessionId: string
  /** Pièce actuellement active (sidebar). Slug ou uuid. */
  activeRoomId: string | null
  /** Pièce active (nom humain) — pour caption chat. */
  activeRoomName: string | null
  /** Callback déclenché APRÈS écriture IDB pour mettre à jour le chat. */
  onPhotoCaptured: (photo: {
    localId: string
    thumbnailBase64: string
    roomName: string | null
    takenAt: string
  }) => void
  disabled?: boolean
}

interface GpsPositionCache {
  latitude: number | null
  longitude: number | null
  accuracy_meters: number | null
  fetchedAt: number
}

// -----------------------------------------------------------------------------
// Constantes
// -----------------------------------------------------------------------------

/** Durée déclenchant le mode rafale (ms). */
const LONG_PRESS_DELAY_MS = 500
/** Intervalle entre photos en rafale (ms). */
const BURST_INTERVAL_MS = 500
/** Cap anti-spam : max 20 photos par rafale. */
const BURST_MAX_PHOTOS = 20
/** TTL cache GPS (ms). */
const GPS_CACHE_TTL_MS = 5 * 60 * 1000
/** Timeout GPS (ms) — pas de blocage UI. */
const GPS_TIMEOUT_MS = 4_000

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function getDeviceOrientation(): DeviceOrientation {
  if (typeof window === 'undefined') return 'portrait'
  return window.innerHeight >= window.innerWidth ? 'portrait' : 'landscape'
}

function vibrate(durationMs: number): void {
  if (typeof navigator === 'undefined') return
  if (typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(durationMs)
    } catch {
      // Safari iOS : pas supporté — no-op
    }
  }
}

/**
 * Convertit un Blob en data URL base64 (pour thumbnail preview chat).
 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') resolve(result)
      else reject(new Error('FileReader did not return a string'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'))
    reader.readAsDataURL(blob)
  })
}

// -----------------------------------------------------------------------------
// Hook GPS cached
// -----------------------------------------------------------------------------

function useCachedGpsPosition(): {
  getPosition: () => Promise<GpsPositionCache | null>
} {
  const cacheRef = useRef<GpsPositionCache | null>(null)

  const getPosition = useCallback(async (): Promise<GpsPositionCache | null> => {
    const cached = cacheRef.current
    if (cached && Date.now() - cached.fetchedAt < GPS_CACHE_TTL_MS) {
      return cached
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) return null

    return new Promise<GpsPositionCache | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c: GpsPositionCache = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy_meters: pos.coords.accuracy,
            fetchedAt: Date.now(),
          }
          cacheRef.current = c
          resolve(c)
        },
        () => resolve(null),
        {
          enableHighAccuracy: false,
          timeout: GPS_TIMEOUT_MS,
          maximumAge: GPS_CACHE_TTL_MS,
        },
      )
    })
  }, [])

  return { getPosition }
}

// -----------------------------------------------------------------------------
// Composant principal
// -----------------------------------------------------------------------------

export function PhotoCaptureButton({
  dossierId,
  missionSessionId,
  activeRoomId,
  activeRoomName,
  onPhotoCaptured,
  disabled = false,
}: PhotoCaptureButtonProps): React.ReactElement {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const burstIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const burstCountRef = useRef<number>(0)
  const isBurstActiveRef = useRef<boolean>(false)
  const longPressTriggeredRef = useRef<boolean>(false)
  const burstStreamRef = useRef<MediaStream | null>(null)
  const burstVideoRef = useRef<HTMLVideoElement | null>(null)

  const [isBursting, setIsBursting] = useState<boolean>(false)
  const [burstCount, setBurstCount] = useState<number>(0)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const { getPosition } = useCachedGpsPosition()

  // ----- Pipeline traitement d'un fichier/blob source -----
  const processCapturedFile = useCallback(
    async (file: File | Blob): Promise<void> => {
      setIsProcessing(true)
      try {
        // 1. Compression JPEG q=0.8 max 1920px (cap ~250KB)
        const {
          blob: compressedBlob,
          width,
          height,
        } = await compressImage(file, {
          maxDim: 1920,
          quality: 0.8,
          mimeType: 'image/jpeg',
        })

        // 2. Thumbnail 200x200 q=0.7 pour preview chat
        const { blob: thumbBlob } = await compressImage(file, {
          maxDim: 200,
          quality: 0.7,
          mimeType: 'image/jpeg',
        })
        const thumbBase64 = await blobToBase64(thumbBlob)

        // 3. GPS (cached, non-bloquant)
        const gps = await getPosition()

        // 4. Métadonnées
        const metadata: PendingPhotoMetadata = {
          taken_at: new Date().toISOString(),
          latitude: gps?.latitude ?? null,
          longitude: gps?.longitude ?? null,
          accuracy_meters: gps?.accuracy_meters ?? null,
          device_orientation: getDeviceOrientation(),
          width,
          height,
          size_bytes: compressedBlob.size,
        }

        // 5. Écriture IndexedDB Dexie
        const localId = await addPhoto({
          dossier_id: dossierId,
          mission_session_id: missionSessionId,
          room_id: activeRoomId,
          blob: compressedBlob,
          thumbnail_base64: thumbBase64,
          metadata,
        })

        // 6. Callback parent (bulle chat USER avec status pending)
        onPhotoCaptured({
          localId,
          thumbnailBase64: thumbBase64,
          roomName: activeRoomName,
          takenAt: metadata.taken_at,
        })

        // 7. Kick sync manager (best-effort)
        void photosSyncManager.kick()
      } catch (e) {
        console.warn('[PhotoCaptureButton] processing failed', e)
      } finally {
        setIsProcessing(false)
      }
    },
    [dossierId, missionSessionId, activeRoomId, activeRoomName, onPhotoCaptured, getPosition],
  )

  // ----- Tap court : ouvre l'input file natif -----
  const handleSingleTap = useCallback(() => {
    if (disabled) return
    fileInputRef.current?.click()
  }, [disabled])

  // ----- Handler input file (single photo path) -----
  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (!file) return
      vibrate(50)
      await processCapturedFile(file)
    },
    [processCapturedFile],
  )

  // ----- Stop rafale (cleanup stream + interval) -----
  const stopBurst = useCallback(() => {
    if (burstIntervalRef.current) {
      clearInterval(burstIntervalRef.current)
      burstIntervalRef.current = null
    }
    if (burstStreamRef.current) {
      for (const t of burstStreamRef.current.getTracks()) t.stop()
      burstStreamRef.current = null
    }
    if (burstVideoRef.current) {
      burstVideoRef.current.pause()
      burstVideoRef.current.srcObject = null
      if (burstVideoRef.current.parentNode) {
        burstVideoRef.current.parentNode.removeChild(burstVideoRef.current)
      }
      burstVideoRef.current = null
    }
    isBurstActiveRef.current = false
    setIsBursting(false)
    setBurstCount(0)
  }, [])

  // ----- Capture une frame en rafale -----
  const captureBurstFrame = useCallback(async (): Promise<void> => {
    if (burstCountRef.current >= BURST_MAX_PHOTOS) {
      stopBurst()
      return
    }

    try {
      const stream = burstStreamRef.current
      if (!stream) return

      const track = stream.getVideoTracks()[0]
      if (!track) return

      let blob: Blob | null = null

      // ImageCapture API (Chrome/Edge desktop + Android) — meilleure qualité
      const ImageCaptureCtor = (
        window as unknown as {
          ImageCapture?: new (
            track: MediaStreamTrack,
          ) => {
            takePhoto(): Promise<Blob>
          }
        }
      ).ImageCapture

      if (ImageCaptureCtor) {
        try {
          const ic = new ImageCaptureCtor(track)
          blob = await ic.takePhoto()
        } catch {
          // Fallback ci-dessous
        }
      }

      if (!blob) {
        // Fallback canvas depuis video element (Safari iOS)
        const video = burstVideoRef.current
        if (!video) return
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(video, 0, 0)
        blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92)
        })
        if (!blob) return
      }

      vibrate(30)
      burstCountRef.current += 1
      setBurstCount(burstCountRef.current)
      // Non-bloquant : on n'await pas le pipeline complet (sinon on rate l'intervalle)
      void processCapturedFile(blob)
    } catch (e) {
      console.warn('[PhotoCaptureButton] burst frame failed', e)
    }
  }, [stopBurst, processCapturedFile])

  // ----- Démarre la rafale (post long press) -----
  const startBurst = useCallback(async (): Promise<void> => {
    if (disabled) return
    if (isBurstActiveRef.current) return

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      // Pas de getUserMedia (HTTP en dev ?) — fallback silencieux sur single tap
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })
      burstStreamRef.current = stream

      const video = document.createElement('video')
      video.srcObject = stream
      video.playsInline = true
      video.muted = true
      video.style.position = 'fixed'
      video.style.left = '-9999px'
      video.style.width = '1px'
      video.style.height = '1px'
      document.body.appendChild(video)
      burstVideoRef.current = video
      await video.play()

      isBurstActiveRef.current = true
      burstCountRef.current = 0
      setBurstCount(0)
      setIsBursting(true)
      vibrate(80)

      // Première frame immédiate puis intervalle
      void captureBurstFrame()
      burstIntervalRef.current = setInterval(() => {
        void captureBurstFrame()
      }, BURST_INTERVAL_MS)
    } catch (e) {
      console.warn('[PhotoCaptureButton] getUserMedia failed', e)
      isBurstActiveRef.current = false
      setIsBursting(false)
    }
  }, [disabled, captureBurstFrame])

  // ----- Cleanup au démontage -----
  useEffect(() => {
    return () => {
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current)
      stopBurst()
    }
  }, [stopBurst])

  // ----- Press handlers (pointer events = souris + touch + stylet) -----
  const handlePressStart = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled) return
      e.preventDefault()
      longPressTriggeredRef.current = false
      burstTimerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true
        void startBurst()
      }, LONG_PRESS_DELAY_MS)
    },
    [disabled, startBurst],
  )

  const handlePressEnd = useCallback(() => {
    if (burstTimerRef.current) {
      clearTimeout(burstTimerRef.current)
      burstTimerRef.current = null
    }
    if (longPressTriggeredRef.current) {
      stopBurst()
    } else {
      handleSingleTap()
    }
    longPressTriggeredRef.current = false
  }, [stopBurst, handleSingleTap])

  // ----- Label aria dynamique -----
  const ariaLabel = isBursting
    ? `Mode rafale actif — ${burstCount} photo${burstCount > 1 ? 's' : ''} capturée${burstCount > 1 ? 's' : ''}, relâchez pour arrêter`
    : 'Prendre une photo (tap court) ou maintenir pour la rafale'

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-pressed={isBursting}
        aria-busy={isProcessing}
        disabled={disabled}
        onPointerDown={handlePressStart}
        onPointerUp={handlePressEnd}
        onPointerLeave={handlePressEnd}
        onPointerCancel={handlePressEnd}
        className={cn(
          'relative inline-flex items-center justify-center shrink-0',
          'size-10 rounded-full transition-all duration-150',
          'hover:bg-sage-alt focus:outline-none focus:ring-2 focus:ring-chartreuse/40',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          isBursting && 'bg-chartreuse text-[#0F1419] scale-110',
        )}
      >
        <Camera className={cn('size-4 transition-transform', isBursting && 'scale-110')} />
        {isBursting && burstCount > 0 ? (
          <span
            className={cn(
              'absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5',
              'rounded-full bg-[#0F1419] text-chartreuse',
              'font-mono text-[10px] font-semibold',
              'inline-flex items-center justify-center',
            )}
            aria-hidden
          >
            +{burstCount}
          </span>
        ) : null}
      </button>

      {/* Input file natif (utilisé en tap court) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden
      />
    </>
  )
}
