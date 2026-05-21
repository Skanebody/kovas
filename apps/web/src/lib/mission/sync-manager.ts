'use client'

/**
 * KOVAS — Sync manager du mode Capture-First (V1.5 iteration 4).
 *
 * Job background côté client qui consume la queue IndexedDB et :
 *   1. Upload le blob compressé + thumbnail vers Supabase Storage (bucket `mission-photos`)
 *   2. Appelle la server action `uploadCapturePhotoAction` pour INSERT photos
 *   3. Résout `attachedPhotoServerId` pour les voice/text notes locales pendantes
 *      attachées à cette photo
 *   4. Marque local `uploaded` + `serverPhotoId`
 *   5. Idem pour les voice notes (upload blob + INSERT + trigger transcription async)
 *   6. Idem pour les text notes (server action createTextNoteAction)
 *
 * Trigger Vision IA : retardé de TRIGGER_ANALYZE_DELAY_MS pour laisser le temps
 * à l'annotation associée d'arriver dans la DB avant le call vision-analyzer.
 *
 * Lifecycle :
 *   - start() au mount du CaptureScreen
 *   - écoute `online` + retry périodique 30s
 *   - chaque syncAll() est idempotent et protégé par un mutex `running`
 */

import {
  createCaptureVoiceNoteAction,
  createTextNoteAction,
  uploadCapturePhotoAction,
} from '@/app/dashboard/dossiers/[id]/mission/actions'
import { createClient } from '@/lib/supabase/client'
import {
  getPendingPhotos,
  getPendingTextNotes,
  getPendingVoiceNotes,
  markPhotoFailed,
  markPhotoUploaded,
  markTextNoteFailed,
  markTextNoteUploaded,
  markVoiceNoteFailed,
  markVoiceNoteUploaded,
  resolveTextNotePhotoServerId,
  resolveVoiceNotePhotoServerId,
} from './local-storage-queue'
import type {
  QueuedPhotoOperation,
  QueuedTextNoteOperation,
  QueuedVoiceNoteOperation,
} from './types'

const POLL_INTERVAL_MS = 30_000
/**
 * Délai avant trigger Vision IA après upload photo, pour laisser une fenêtre
 * à l'annotation (voice note 30s max) d'arriver côté serveur.
 *
 * 5000ms = 3500ms (PostPhotoActionBar timeout) + 30s max voix → conservateur.
 * Pour V1.5 on choisit 5000ms (compromis : suffisant pour text notes courtes,
 * et l'analyse Vision IA récupèrera la voice note transcrite OU sa transcription
 * async la mettra à jour ultérieurement).
 *
 * Note V2 : remplacer par déclenchement event-driven (quand l'annotation finit son
 * upload, on appelle l'analyzer).
 */
const TRIGGER_ANALYZE_DELAY_MS = 5_000

interface SyncContext {
  orgId: string
  dossierId: string
}

export class CaptureSyncManager {
  private running = false
  private intervalId: ReturnType<typeof setInterval> | null = null
  private context: SyncContext | null = null
  private onlineListener: (() => void) | null = null
  /** Anti-rebond : empêche de relancer un sync sur la même opération en parallèle. */
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
      // Ordre important : photos d'abord (résout serverPhotoId), puis voice/text
      // (pour pouvoir inclure attached_photo_id à l'INSERT).
      await this.uploadPendingPhotos(this.context)
      await this.uploadPendingVoiceNotes(this.context)
      await this.uploadPendingTextNotes(this.context)
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

    // 5. Résout l'attachedPhotoServerId des voice/text notes locales qui
    //    référencent cette photo, pour qu'au prochain syncAll() elles puissent
    //    INSERT avec attached_photo_id.
    await resolveVoiceNotePhotoServerId(photo.id, result.photoId)
    await resolveTextNotePhotoServerId(photo.id, result.photoId)

    // 6. Trigger Vision IA en fire-and-forget côté serveur, AVEC DÉLAI.
    //    Le délai laisse une fenêtre à l'annotation associée pour finir son
    //    upload + INSERT. Si la transcription async n'est pas prête, le call
    //    vision-analyzer récupèrera la voice_notes row sans transcript_raw —
    //    acceptable V1.5 (cf. brief iteration 4 §9).
    //
    //    Photos floues : le serveur a déjà mis vision_status='skipped_blurry'
    //    via uploadCapturePhotoAction, donc l'appel sera idempotent (noop).
    if (!photo.isBlurry) {
      this.scheduleVisionAnalyze(result.photoId)
    }
  }

  private scheduleVisionAnalyze(serverPhotoId: string): void {
    if (typeof window === 'undefined') return
    window.setTimeout(() => {
      void fetch(`/api/missions/photos/${serverPhotoId}/analyze`, {
        method: 'POST',
        credentials: 'same-origin',
        keepalive: true,
      }).catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : 'unknown'
        console.warn('[CaptureSyncManager] vision trigger failed', msg)
      })
    }, TRIGGER_ANALYZE_DELAY_MS)
  }

  // ============================================
  // Voice notes
  // ============================================

  private async uploadPendingVoiceNotes(ctx: SyncContext): Promise<void> {
    const pending = await getPendingVoiceNotes(ctx.dossierId)
    if (pending.length === 0) return

    const supabase = createClient()

    for (const voice of pending) {
      if (this.inflightLocalIds.has(voice.id)) continue

      // Si la voice note est attachée à une photo locale pas encore uploadée,
      // on skip pour ce tour. Le prochain syncAll() reprendra.
      if (voice.attachedLocalPhotoId && !voice.attachedPhotoServerId) {
        continue
      }

      this.inflightLocalIds.add(voice.id)
      try {
        await this.uploadOneVoiceNote(ctx, supabase, voice)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown'
        await markVoiceNoteFailed(voice.id, msg)
      } finally {
        this.inflightLocalIds.delete(voice.id)
      }
    }
  }

  private async uploadOneVoiceNote(
    ctx: SyncContext,
    supabase: ReturnType<typeof createClient>,
    voice: QueuedVoiceNoteOperation,
  ): Promise<void> {
    // Path : <orgId>/<dossierId>/<localId>.<ext>
    const ext = mimeToExt(voice.mimeType)
    const storagePath = `${ctx.orgId}/${voice.dossierId}/${voice.id}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('voice-notes')
      .upload(storagePath, voice.blob, {
        contentType: voice.mimeType || 'audio/webm',
        cacheControl: '3600',
        upsert: true,
      })
    if (uploadErr) {
      throw new Error(`Upload voice-notes : ${uploadErr.message}`)
    }

    const result = await createCaptureVoiceNoteAction(
      voice.dossierId,
      voice.attachedPhotoServerId,
      storagePath,
      voice.durationSeconds,
      voice.roomId,
    )

    if ('error' in result) {
      throw new Error(result.error)
    }

    await markVoiceNoteUploaded(voice.id, result.voiceNoteId)

    // Trigger transcription async (best-effort, non bloquant)
    this.triggerTranscription(voice, storagePath)
  }

  private triggerTranscription(voice: QueuedVoiceNoteOperation, _storagePath: string): void {
    if (typeof window === 'undefined') return

    void (async () => {
      try {
        const form = new FormData()
        form.append('audio', voice.blob, `${voice.id}.${mimeToExt(voice.mimeType)}`)
        form.append('dossierId', voice.dossierId)
        const res = await fetch('/api/transcribe', {
          method: 'POST',
          body: form,
          credentials: 'same-origin',
          keepalive: true,
        })
        if (!res.ok) {
          console.warn('[CaptureSyncManager] transcribe failed', res.status)
          return
        }
        const data = (await res.json()) as { transcript?: string }
        // Note : on ne PATCH pas la row voice_notes côté client (RLS) ;
        // l'API /api/transcribe ne le fait pas non plus actuellement.
        // V1.5 : la transcription est juste loggée (utile pour debug).
        // L'analyse Vision IA récupère voice_notes.transcript_raw qui peut
        // être null si la transcription n'a pas encore été persistée — TODO V2.
        if (typeof data.transcript === 'string') {
          console.info('[CaptureSyncManager] transcribed', voice.id, data.transcript.slice(0, 60))
        }
      } catch (err) {
        console.warn(
          '[CaptureSyncManager] transcribe trigger error',
          err instanceof Error ? err.message : 'unknown',
        )
      }
    })()
  }

  // ============================================
  // Text notes
  // ============================================

  private async uploadPendingTextNotes(ctx: SyncContext): Promise<void> {
    const pending = await getPendingTextNotes(ctx.dossierId)
    if (pending.length === 0) return

    for (const text of pending) {
      if (this.inflightLocalIds.has(text.id)) continue
      // Skip si attaché à une photo locale pas encore uploadée
      if (text.attachedLocalPhotoId && !text.attachedPhotoServerId) {
        continue
      }
      this.inflightLocalIds.add(text.id)
      try {
        await this.uploadOneTextNote(ctx, text)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown'
        await markTextNoteFailed(text.id, msg)
      } finally {
        this.inflightLocalIds.delete(text.id)
      }
    }
  }

  private async uploadOneTextNote(_ctx: SyncContext, text: QueuedTextNoteOperation): Promise<void> {
    const result = await createTextNoteAction(
      text.dossierId,
      text.attachedPhotoServerId,
      text.text,
      text.roomId,
    )
    if ('error' in result) {
      throw new Error(result.error)
    }
    await markTextNoteUploaded(text.id, result.textNoteId)
  }
}

export const captureSyncManager = new CaptureSyncManager()

// ============================================
// Helpers
// ============================================

function mimeToExt(mime: string): string {
  if (!mime) return 'webm'
  if (mime.includes('mp4')) return 'm4a'
  if (mime.includes('ogg')) return 'ogg'
  if (mime.includes('webm')) return 'webm'
  return 'webm'
}
