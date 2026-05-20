'use client'

/**
 * KOVAS — Coquille principale du mode terrain Capture-First (V1.5 iteration 2).
 *
 * Itération 2 : flow end-to-end capture photo →
 *   1. preprocessPhoto (compression + thumbnail + dHash + blur detect)
 *   2. enqueuePhoto vers IndexedDB locale
 *   3. carrousel UI temps réel via useLiveQuery (useCapturePhotos)
 *   4. sync background captureSyncManager (upload Storage + INSERT photos)
 *
 * Authority : CLAUDE.md §3 features 1-2-10 + iteration 2 brief.
 */

import { AppShell } from '@/components/app-shell'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { enqueuePhoto } from '@/lib/mission/local-storage-queue'
import { preprocessPhoto } from '@/lib/mission/photo-processor'
import { captureSyncManager } from '@/lib/mission/sync-manager'
import { type DisplayPhoto, useCapturePhotos } from '@/lib/mission/use-capture-photos'
import { useVisionStatus } from '@/lib/mission/use-vision-status'
import { cn } from '@/lib/utils'
import {
  AlertTriangle,
  CheckCircle2,
  ImageOff,
  Loader2,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useState, useTransition } from 'react'
import { MissionToolbar } from './mission-toolbar'
import { PhotoButton } from './photo-button'
import { type RoomOption, RoomPicker } from './room-picker'

interface CaptureScreenProps {
  dossier: {
    id: string
    reference: string
  }
  /** Org de l'utilisateur (utilisé pour le storage path `<orgId>/<dossierId>/...`). */
  orgId: string
  rooms: RoomOption[]
}

export function CaptureScreen({ dossier, orgId, rooms: initialRooms }: CaptureScreenProps) {
  const [rooms, setRooms] = useState<RoomOption[]>(initialRooms)
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(initialRooms[0]?.id ?? null)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [isProcessing, startProcessing] = useTransition()
  const [previewPhoto, setPreviewPhoto] = useState<DisplayPhoto | null>(null)

  const currentRoom = rooms.find((r) => r.id === currentRoomId) ?? null

  const { photos, pendingCount, failedCount, retryAll } = useCapturePhotos(
    dossier.id,
    currentRoomId,
  )

  // Démarrage du sync manager (one-shot par dossier — start() est idempotent)
  useEffect(() => {
    captureSyncManager.start({ orgId, dossierId: dossier.id })
    return () => {
      captureSyncManager.stop()
    }
  }, [orgId, dossier.id])

  const photoButtonVariant: 'default' | 'empty' = photos.length === 0 ? 'empty' : 'default'

  function handleSelectRoom(room: RoomOption) {
    setCurrentRoomId(room.id)
  }

  function handleRoomCreated(room: RoomOption) {
    setRooms((prev) => {
      if (prev.some((r) => r.id === room.id)) return prev
      return [...prev, room]
    })
    setCurrentRoomId(room.id)
  }

  function handlePhotoCaptured(file: File) {
    if (!currentRoomId || !currentRoom) {
      setCaptureError('Sélectionnez une pièce avant de capturer.')
      return
    }
    setCaptureError(null)
    startProcessing(async () => {
      try {
        const processed = await preprocessPhoto(file)
        await enqueuePhoto({
          dossierId: dossier.id,
          roomId: currentRoomId,
          roomName: currentRoom.name,
          blob: processed.compressedBlob,
          thumbnailBlob: processed.thumbnailBlob,
          capturedAt: processed.capturedAt,
          width: processed.width,
          height: processed.height,
          sizeBytes: processed.sizeBytes,
          perceptualHash: processed.perceptualHash,
          isBlurry: processed.isBlurry,
          deviceInfo: collectDeviceInfo(processed.capturedAt),
        })
        // Le sync manager pollera ; on déclenche un sync immédiat pour réactivité.
        void captureSyncManager.syncAll()
      } catch (e) {
        setCaptureError(e instanceof Error ? e.message : 'Erreur préparation photo')
      }
    })
  }

  function handleNextRoom() {
    // Iteration 2 : ouvre le sélecteur de pièce / création
    setCurrentRoomId(null)
  }

  function handleRetryAll() {
    void retryAll()
  }

  return (
    <AppShell background="light">
      <MissionToolbar
        dossierId={dossier.id}
        dossierReference={dossier.reference}
        currentRoomName={currentRoom?.name ?? null}
        roomPickerSlot={
          <RoomPicker
            dossierId={dossier.id}
            rooms={rooms}
            currentRoomId={currentRoomId}
            onSelectRoom={handleSelectRoom}
            onRoomCreated={handleRoomCreated}
          />
        }
      />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Bandeau sync (si pending ou failed) */}
        {pendingCount > 0 || failedCount > 0 ? (
          <div
            className={cn(
              'mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5',
              failedCount > 0
                ? 'border-accent-red/30 bg-accent-red/5'
                : 'border-rule bg-cream-deep/30',
            )}
          >
            <div className="flex items-center gap-2 text-sm text-ink">
              {failedCount > 0 ? (
                <AlertTriangle className="h-4 w-4 text-accent-red" aria-hidden />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-ink-soft" aria-hidden />
              )}
              <span>
                {pendingCount > 0 ? (
                  <>
                    {pendingCount} photo{pendingCount > 1 ? 's' : ''} en cours de synchronisation
                  </>
                ) : null}
                {pendingCount > 0 && failedCount > 0 ? ' · ' : ''}
                {failedCount > 0 ? (
                  <span className="text-accent-red">
                    {failedCount} échec{failedCount > 1 ? 's' : ''}
                  </span>
                ) : null}
              </span>
            </div>
            {failedCount > 0 ? (
              <Button type="button" variant="outline" size="sm" onClick={handleRetryAll}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Réessayer
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 xl:gap-8">
          {/* Colonne capture */}
          <section className={cn('space-y-6', 'xl:col-span-7')} aria-label="Capture terrain">
            {/* Carrousel photos pièce courante */}
            <Card variant="opaque" padding="default" className="space-y-4">
              <header className="flex items-center justify-between">
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
                  Photos pièce courante
                </p>
                <span className="text-sm text-ink-soft">
                  {photos.length} photo{photos.length > 1 ? 's' : ''}
                </span>
              </header>

              {photos.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-ink-mute">
                  <ImageOff className="h-8 w-8" aria-hidden />
                  <p className="text-sm">Aucune photo pour cette pièce</p>
                </div>
              ) : (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {photos.map((photo) => (
                    <PhotoThumbnail
                      key={photo.id}
                      photo={photo}
                      onClick={() => setPreviewPhoto(photo)}
                    />
                  ))}
                </div>
              )}
            </Card>

            {/* PhotoButton géant */}
            <div className="flex flex-col items-center gap-6 py-6">
              <PhotoButton
                variant={photoButtonVariant}
                disabled={currentRoomId === null || isProcessing}
                onPhotoCaptured={handlePhotoCaptured}
              />
              {isProcessing ? (
                <p className="flex items-center gap-2 text-sm text-ink-soft">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Préparation de la photo…
                </p>
              ) : null}

              {currentRoomId === null ? (
                <p className="max-w-xs text-center text-sm text-ink-mute">
                  Sélectionnez ou créez une pièce pour commencer à capturer.
                </p>
              ) : null}

              {captureError ? (
                <p className="max-w-xs text-center text-sm text-accent-red" role="alert">
                  {captureError}
                </p>
              ) : null}
            </div>

            {/* CTA pièce suivante */}
            <div className="flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleNextRoom}
                className="gap-2"
              >
                <Plus className="h-4 w-4" aria-hidden />
                Pièce suivante
              </Button>
            </div>
          </section>

          {/* Colonne cockpit (xl+) */}
          <aside className="hidden xl:col-span-5 xl:block" aria-label="Cockpit progression">
            <Card variant="opaque" padding="lg" className="h-full">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-mute">
                Cockpit progression
              </p>
              <h2 className="mt-2 font-serif text-2xl italic text-ink">À venir — itération 7</h2>
              <p className="mt-4 text-sm text-ink-soft">
                Vue temps réel du remplissage des champs DPE / Amiante, propositions IA et conflits
                à valider apparaîtront ici une fois la consolidation Vision IA branchée.
              </p>
            </Card>
          </aside>
        </div>
      </main>

      {/* Modal preview simple */}
      {previewPhoto ? (
        <button
          type="button"
          className={cn(
            'fixed inset-0 z-40 flex items-center justify-center bg-ink/80 backdrop-blur-sm',
            'animate-fade-in',
          )}
          onClick={() => setPreviewPhoto(null)}
          aria-label="Fermer l'aperçu"
        >
          <div className="relative max-h-[90vh] max-w-[90vw]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewPhoto.thumbnailUrl}
              alt="Aperçu capture terrain"
              className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
            />
            <div className={cn('absolute top-2 right-2 rounded-full bg-paper/90 p-2', 'shadow-md')}>
              <X className="h-4 w-4 text-ink" aria-hidden />
            </div>
          </div>
        </button>
      ) : null}
    </AppShell>
  )
}

// ============================================
// Vignettes carrousel
// ============================================

interface PhotoThumbnailProps {
  photo: DisplayPhoto
  onClick: () => void
}

function PhotoThumbnail({ photo, onClick }: PhotoThumbnailProps) {
  // Polling Vision IA — uniquement si la photo est uploadée + non floue.
  const vision = useVisionStatus(photo.serverPhotoId, photo.isBlurry)
  const visionLabel = visionStatusLabel(vision.status, vision.fieldsCount, vision.confidence)

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative shrink-0 overflow-hidden rounded-xl',
        'h-20 w-20 sm:h-24 sm:w-24',
        'border bg-cream-deep/40',
        photo.isBlurry ? 'border-accent-orange/60' : 'border-rule',
        'transition-transform hover:-translate-y-0.5 hover:shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/40',
      )}
      title={
        photo.isBlurry
          ? 'Photo floue — ne sera pas analysée par Vision IA'
          : `${new Date(photo.capturedAt).toLocaleTimeString('fr-FR')} · ${visionLabel}`
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.thumbnailUrl} alt="Capture terrain" className="h-full w-full object-cover" />

      {/* Badge sync status */}
      <span
        className={cn(
          'absolute right-1 bottom-1 inline-flex items-center justify-center',
          'h-5 w-5 rounded-full border border-paper text-[10px]',
          'shadow-sm backdrop-blur-sm',
          photo.syncStatus === 'uploaded' && 'bg-accent-green text-paper',
          photo.syncStatus === 'pending_upload' && 'bg-paper/90 text-ink',
          photo.syncStatus === 'failed' && 'bg-accent-red text-paper',
        )}
        aria-label={syncStatusLabel(photo.syncStatus)}
      >
        {photo.syncStatus === 'uploaded' ? (
          <CheckCircle2 className="h-3 w-3" aria-hidden />
        ) : photo.syncStatus === 'failed' ? (
          <AlertTriangle className="h-3 w-3" aria-hidden />
        ) : (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        )}
      </span>

      {/* Badge Vision IA — seulement si la photo est uploadée et non floue */}
      {photo.syncStatus === 'uploaded' && !photo.isBlurry ? (
        <VisionBadge status={vision.status} fieldsCount={vision.fieldsCount} />
      ) : null}

      {/* Badge floue */}
      {photo.isBlurry ? (
        <span
          className={cn(
            'absolute top-1 left-1 inline-flex items-center justify-center',
            'h-5 w-5 rounded-full bg-accent-orange text-paper',
            'shadow-sm',
          )}
          aria-label="Photo floue"
          title="Photo floue — ne sera pas analysée"
        >
          <AlertTriangle className="h-3 w-3" aria-hidden />
        </span>
      ) : null}
    </button>
  )
}

// ============================================
// Vision IA badge
// ============================================

interface VisionBadgeProps {
  status: import('@/lib/mission/types').VisionStatus
  fieldsCount: number
}

function VisionBadge({ status, fieldsCount }: VisionBadgeProps) {
  if (status === 'pending' || status === 'processing') {
    return (
      <span
        className={cn(
          'absolute top-1 right-1 inline-flex items-center justify-center',
          'h-5 w-5 rounded-full bg-paper/90 text-ink shadow-sm backdrop-blur-sm',
        )}
        aria-label="Analyse Vision IA en cours"
        title="Analyse Vision IA en cours…"
      >
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      </span>
    )
  }
  if (status === 'analyzed') {
    return (
      <span
        className={cn(
          'absolute top-1 right-1 inline-flex items-center justify-center',
          'h-5 w-5 rounded-full bg-chartreuse text-ink shadow-sm',
        )}
        aria-label={`Analysée — ${fieldsCount} champ${fieldsCount > 1 ? 's' : ''} détecté${fieldsCount > 1 ? 's' : ''}`}
        title={`Analysée — ${fieldsCount} champ${fieldsCount > 1 ? 's' : ''} détecté${fieldsCount > 1 ? 's' : ''}`}
      >
        <Sparkles className="h-3 w-3" aria-hidden />
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span
        className={cn(
          'absolute top-1 right-1 inline-flex items-center justify-center',
          'h-5 w-5 rounded-full bg-accent-red text-paper shadow-sm',
        )}
        aria-label="Analyse Vision échouée"
        title="Analyse Vision échouée — réessayera plus tard"
      >
        <AlertTriangle className="h-3 w-3" aria-hidden />
      </span>
    )
  }
  // skipped_* → pas de badge supplémentaire
  return null
}

function visionStatusLabel(
  status: import('@/lib/mission/types').VisionStatus,
  fieldsCount: number,
  confidence: number | null,
): string {
  switch (status) {
    case 'pending':
      return 'Vision IA en attente'
    case 'processing':
      return 'Vision IA en cours'
    case 'analyzed': {
      const confLabel =
        typeof confidence === 'number' ? ` · confiance ${Math.round(confidence * 100)}%` : ''
      return `Vision IA terminée — ${fieldsCount} champ${fieldsCount > 1 ? 's' : ''}${confLabel}`
    }
    case 'failed':
      return 'Vision IA en échec'
    case 'skipped_blurry':
      return 'Photo floue — non analysée'
    case 'skipped_duplicate':
      return 'Doublon détecté — non analysée'
    case 'skipped_irrelevant':
      return 'Photo sans intérêt diagnostic'
  }
}

function syncStatusLabel(s: DisplayPhoto['syncStatus']): string {
  switch (s) {
    case 'uploaded':
      return 'Synchronisé'
    case 'pending_upload':
      return 'En attente de synchronisation'
    case 'failed':
      return 'Échec de synchronisation'
  }
}

// ============================================
// deviceInfo collector
// ============================================

function collectDeviceInfo(capturedAt: number) {
  if (typeof window === 'undefined') return undefined
  const screen = window.screen
  const orientation: 'portrait' | 'landscape' =
    window.innerWidth >= window.innerHeight ? 'landscape' : 'portrait'
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    screenWidth: screen.width,
    screenHeight: screen.height,
    pixelRatio: window.devicePixelRatio,
    orientation,
    capturedAtClient: capturedAt,
  }
}
