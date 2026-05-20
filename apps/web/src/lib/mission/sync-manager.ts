'use client'

/**
 * KOVAS — Sync manager du mode Capture-First (V1.5 iteration 2).
 *
 * Job background côté client qui consume la queue IndexedDB et :
 *   1. Upload le blob compressé + thumbnail vers Supabase Storage (bucket `mission-photos`)
 *   2. Appelle la server action `uploadCapturePhotoAction` pour INSERT photos
 *   3. Marque local `uploaded` + `serverPhotoId`
 *
 * Lifecycle :
 *   - start() au mount du CaptureScreen
 *   - écoute `online` + retry périodique 30s
 *   - chaque syncAll() est idempotent et protégé par un mutex `running`
 *
 * Pas de retry exponentiel automatique en itération 2 — si l'upload échoue
 * sur 4xx/5xx, la photo passe en `failed` et l'utilisateur peut retry via
 * le hook. (Itération 4 ajoutera le backoff + Whisper / text notes.)
 */

import { uploadCapturePhotoAction } from '@/app/app/dossiers/[id]/mission/actions'
import { createClient } from '@/lib/supabase/client'
import { getPendingPhotos, markPhotoFailed, markPhotoUploaded } from './local-storage-queue'
import type { QueuedPhotoOperation } from './types'

const POLL_INTERVAL_MS = 30_000

interface SyncContext {
  orgId: string
  dossierId: string
}

export class CaptureSyncManager {
  private running = false
  private intervalId: ReturnType<typeof setInterval> | null = null
  private context: SyncContext | null = null
  private onlineListener: (() => void) | null = null
  /** Anti-rebond : empêche de relancer un sync sur la même photo locale en parallèle. */
  private inflightLocalIds = new Set<string>()

  start(context: SyncContext): void {
    if (typeof window === 'undefined') return
    if (this.context && this.context.dossierId === context.dossierId) {
      // Déjà actif sur ce dossier, no-op
      return
    }
    this.stop()
    this.context = context

    this.onlineListener = () => {
      void this.syncAll()
    }
    window.addEventListener('online', this.onlineListener)

    // Sync immédiat (si déjà online) + périodique
    void this.syncAll()
    this.intervalId = setInterval(() => {
      if (navigator.onLine) void this.syncAll()
    }, POLL_INTERVAL_MS)
  }

  stop(): void {
    if (typeof window === 'undefined') return
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    if (this.onlineListener) {
      window.removeEventListener('online', this.onlineListener)
      this.onlineListener = null
    }
    this.context = null
  }

  async syncAll(): Promise<void> {
    if (this.running) return
    if (typeof window === 'undefined') return
    if (!navigator.onLine) return
    if (!this.context) return

    this.running = true
    try {
      await this.uploadPendingPhotos(this.context)
    } finally {
      this.running = false
    }
  }

  /**
   * Retente un upload manuellement (depuis le hook useCapturePhotos).
   * Reset le statut local en pending_upload puis déclenche un syncAll.
   */
  async retryPhoto(localId: string): Promise<void> {
    if (!this.context) return
    const { getMissionDb } = await import('./local-storage-queue')
    const db = getMissionDb()
    await db.photos.update(localId, {
      syncStatus: 'pending_upload',
      lastError: null,
    })
    await this.syncAll()
  }

  // ============================================
  // Photos
  // ============================================

  private async uploadPendingPhotos(ctx: SyncContext): Promise<void> {
    const pending = await getPendingPhotos(ctx.dossierId)
    if (pending.length === 0) return

    const supabase = createClient()

    for (const photo of pending) {
      if (this.inflightLocalIds.has(photo.id)) continue
      this.inflightLocalIds.add(photo.id)
      try {
        await this.uploadOnePhoto(ctx, supabase, photo)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown'
        await markPhotoFailed(photo.id, msg)
      } finally {
        this.inflightLocalIds.delete(photo.id)
      }
    }
  }

  private async uploadOnePhoto(
    ctx: SyncContext,
    supabase: ReturnType<typeof createClient>,
    photo: QueuedPhotoOperation,
  ): Promise<void> {
    // RLS path convention : <orgId>/<dossierId>/<localId>.jpg
    const storagePath = `${ctx.orgId}/${photo.dossierId}/${photo.id}.jpg`
    const thumbPath = `${ctx.orgId}/${photo.dossierId}/${photo.id}-thumb.jpg`

    // 1. Upload blob principal (idempotent : upsert si la photo a déjà été
    //    partiellement uploadée — évite l'erreur 409 sur retry).
    const { error: uploadErr } = await supabase.storage
      .from('mission-photos')
      .upload(storagePath, photo.blob, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true,
      })
    if (uploadErr) {
      throw new Error(`Upload Storage : ${uploadErr.message}`)
    }

    // 2. Upload thumbnail si présent (best-effort, non bloquant)
    if (photo.thumbnailBlob) {
      const { error: thumbErr } = await supabase.storage
        .from('mission-photos')
        .upload(thumbPath, photo.thumbnailBlob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true,
        })
      if (thumbErr) {
        // Best-effort : on log mais on ne fait pas échouer la photo principale
        // (la vue carrousel mobile utilise le blob local, le thumb sert pour le cockpit web)
        console.warn('[CaptureSyncManager] thumb upload failed', thumbErr.message)
      }
    }

    // 3. Server action INSERT row photos
    const result = await uploadCapturePhotoAction(photo.dossierId, {
      storagePath,
      roomId: photo.roomId,
      roomName: photo.roomName,
      capturedAt: new Date(photo.capturedAt).toISOString(),
      width: photo.width,
      height: photo.height,
      sizeBytes: photo.sizeBytes,
      perceptualHash: photo.perceptualHash,
      isBlurry: photo.isBlurry,
      gpsLat: photo.gpsLat,
      gpsLng: photo.gpsLng,
    })

    if ('error' in result) {
      throw new Error(result.error)
    }

    // 4. Marque uploaded
    await markPhotoUploaded(photo.id, result.photoId)
  }
}

export const captureSyncManager = new CaptureSyncManager()
