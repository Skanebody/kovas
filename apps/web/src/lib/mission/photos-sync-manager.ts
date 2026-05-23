'use client'

/**
 * KOVAS — Mode mission tchat : sync manager photos rafale (MISSION-B).
 *
 * Singleton qui :
 *   - Écoute window.online + intervalle 15s
 *   - Lit getPendingPhotos() depuis Dexie
 *   - Upload concurrent batch de 3 photos en parallèle vers Supabase Storage
 *   - INSERT mission_photos row via REST PostgREST (RLS protect)
 *   - markPhotoSynced() / markPhotoError() avec retry exponential backoff
 *   - Abandon après 5 tentatives, error persisté
 *   - Expose un state { pending, uploading, synced, errors } via subscribers
 *
 * Authority : CLAUDE.md §3 features 2 + 10 + MISSION-B (sync background, retry,
 * offline complet).
 */

import { createClient } from '@/lib/supabase/client'
import {
  type PendingPhoto,
  type PhotosSyncSnapshot,
  getPendingPhotos,
  getSyncSnapshot,
  markPhotoError,
  markPhotoSynced,
  markPhotoUploading,
} from './photos-offline-store'

const POLL_INTERVAL_MS = 15_000
const BATCH_CONCURRENCY = 3
const MAX_ATTEMPTS = 5
/** Backoff exponentiel : 2s, 8s, 32s, 128s, abandon. */
const BACKOFF_BASE_MS = 2_000

interface PhotosSyncContext {
  orgId: string
  dossierId: string
  missionSessionId: string
}

type SubscriberFn = (snap: PhotosSyncSnapshot) => void

export class PhotosSyncManager {
  private running = false
  private intervalId: ReturnType<typeof setInterval> | null = null
  private context: PhotosSyncContext | null = null
  private onlineListener: (() => void) | null = null
  /** Anti-rebond inflight ids. */
  private inflightIds = new Set<string>()
  /** Cooldown par id (timestamp avant lequel on ne retry pas). */
  private nextAttemptAt = new Map<string, number>()
  private subscribers = new Set<SubscriberFn>()

  start(context: PhotosSyncContext): void {
    if (typeof window === 'undefined') return
    if (this.context && this.context.missionSessionId === context.missionSessionId) {
      return
    }
    this.stop()
    this.context = context

    this.onlineListener = () => {
      void this.syncAll()
    }
    window.addEventListener('online', this.onlineListener)

    // Premier sync immédiat (si déjà online) + polling périodique
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
    this.inflightIds.clear()
    this.nextAttemptAt.clear()
  }

  /** S'abonne aux updates de state. Retourne fonction de désabonnement. */
  subscribe(fn: SubscriberFn): () => void {
    this.subscribers.add(fn)
    void this.notifySubscribers()
    return () => {
      this.subscribers.delete(fn)
    }
  }

  private async notifySubscribers(): Promise<void> {
    if (!this.context || this.subscribers.size === 0) return
    try {
      const snap = await getSyncSnapshot(this.context.missionSessionId)
      for (const fn of this.subscribers) fn(snap)
    } catch {
      // best-effort — ne pas faire planter le sync si l'IDB est temporairement indispo
    }
  }

  /** Force un sync immédiat (depuis composant après capture). */
  async kick(): Promise<void> {
    await this.syncAll()
  }

  async syncAll(): Promise<void> {
    if (this.running) return
    if (typeof window === 'undefined') return
    if (!navigator.onLine) {
      await this.notifySubscribers()
      return
    }
    if (!this.context) return

    this.running = true
    try {
      const pending = await getPendingPhotos(this.context.missionSessionId)
      // Filter ceux dont le cooldown n'est pas écoulé ou déjà inflight ou max attempts atteint
      const eligibles = pending.filter((p) => {
        if (this.inflightIds.has(p.id)) return false
        if (p.upload_attempts >= MAX_ATTEMPTS) return false
        const cooldown = this.nextAttemptAt.get(p.id) ?? 0
        return Date.now() >= cooldown
      })

      // Batch parallèle (BATCH_CONCURRENCY simultanés)
      for (let i = 0; i < eligibles.length; i += BATCH_CONCURRENCY) {
        const slice = eligibles.slice(i, i + BATCH_CONCURRENCY)
        await Promise.all(slice.map((p) => this.uploadOne(p)))
      }
      await this.notifySubscribers()
    } finally {
      this.running = false
    }
  }

  private async uploadOne(photo: PendingPhoto): Promise<void> {
    if (!this.context) return
    if (this.inflightIds.has(photo.id)) return
    this.inflightIds.add(photo.id)

    try {
      await markPhotoUploading(photo.id)
      await this.notifySubscribers()

      const supabase = createClient()
      // Path convention bucket mission-photos : <orgId>/<dossierId>/<photoId>.jpg
      // (compatible avec RLS storage existante : 1er segment = org_id)
      const storagePath = `${this.context.orgId}/${photo.dossier_id}/${photo.id}.jpg`

      // 1. Upload blob compressé vers Supabase Storage (upsert idempotent)
      const { error: uploadErr } = await supabase.storage
        .from('mission-photos')
        .upload(storagePath, photo.blob, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true,
        })
      if (uploadErr) {
        throw new Error(`Storage upload : ${uploadErr.message}`)
      }

      // 2. INSERT row mission_photos via PostgREST (RLS auth.uid via cookie)
      const insertPayload = {
        mission_session_id: photo.mission_session_id,
        dossier_id: photo.dossier_id,
        room_id: photo.room_id,
        storage_path: storagePath,
        storage_bucket: 'mission-photos',
        thumbnail_base64: photo.thumbnail_base64,
        metadata: photo.metadata,
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('mission_photos' as never)
        .insert(insertPayload as never)
        .select('id')
        .single()

      if (insertErr || !inserted) {
        throw new Error(`INSERT mission_photos : ${insertErr?.message ?? 'no row returned'}`)
      }

      const serverId = (inserted as { id: string }).id
      await markPhotoSynced(photo.id, serverId, storagePath)
      this.nextAttemptAt.delete(photo.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      await markPhotoError(photo.id, msg)
      // Schedule next retry : backoff exponentiel
      const nextAttempt = photo.upload_attempts + 1
      const delayMs = BACKOFF_BASE_MS * 4 ** (nextAttempt - 1)
      this.nextAttemptAt.set(photo.id, Date.now() + delayMs)
    } finally {
      this.inflightIds.delete(photo.id)
      await this.notifySubscribers()
    }
  }
}

export const photosSyncManager = new PhotosSyncManager()
