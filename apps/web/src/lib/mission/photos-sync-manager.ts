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
 *   - Expose un state { pending, uploading, synced, errors } via subscribers
 *
 * Robustesse réseau instable (audit P0 terrain — sous-sol / vide-sanitaire) :
 *   - P0-1 : upsert idempotent (client_local_id) — un rejeu ne crée pas de
 *     doublon.
 *   - P0-3 : pas d'exclusion définitive — au retour `online`, on réarme les
 *     photos en `error` (reset compteur) et on relance un cycle.
 *   - P0-5 : on ne consomme une tentative QUE sur échec réseau réel alors que
 *     navigator.onLine === true. Hors-ligne = on ne tente pas et on ne
 *     décompte pas. Backoff plafonné à 5 min.
 *
 * Authority : CLAUDE.md §3 features 2 + 10 + MISSION-B (sync background, retry,
 * offline complet).
 */

import { createClient } from '@/lib/supabase/client'
import {
  type PendingPhoto,
  type PhotosSyncSnapshot,
  getPendingPhotos,
  getSessionsWithPendingPhotos,
  getSyncSnapshot,
  markPhotoError,
  markPhotoSynced,
  markPhotoUploading,
  resetErroredPhotosToPending,
} from './photos-offline-store'

const POLL_INTERVAL_MS = 15_000
const BATCH_CONCURRENCY = 3
/**
 * Backoff exponentiel : 2s, 8s, 32s, 128s, puis plafonné.
 * (P0-5) Plafond à 5 min pour ne pas laisser une photo en attente trop
 * longtemps quand le réseau est revenu mais instable.
 * (P0-3) Plus de MAX_ATTEMPTS : aucune photo n'est exclue définitivement —
 * elle reste réessayée tant qu'elle n'est pas synchronisée.
 */
const BACKOFF_BASE_MS = 2_000
const BACKOFF_MAX_MS = 5 * 60_000

interface PhotosSyncContext {
  orgId: string
  dossierId: string
  missionSessionId: string
}

type SubscriberFn = (snap: PhotosSyncSnapshot) => void

export class PhotosSyncManager {
  private running = false
  /** Verrou dédié au sync global (P0-4) pour ne pas se télescoper avec syncAll. */
  private globalRunning = false
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

    // (P0-3) Au retour réseau, on réarme les photos en `error` (reset du
    // compteur de tentatives) AVANT de relancer un cycle — sinon une photo
    // ayant épuisé ses tentatives en sous-sol resterait perdue à vie.
    this.onlineListener = () => {
      void this.handleOnline()
    }
    window.addEventListener('online', this.onlineListener)

    // Premier sync immédiat (si déjà online) + polling périodique
    void this.syncAll()
    this.intervalId = setInterval(() => {
      if (navigator.onLine) void this.syncAll()
    }, POLL_INTERVAL_MS)
  }

  /**
   * (P0-3) Handler `online` : réarme les photos en erreur de la session
   * courante (reset tentatives) puis relance un cycle de sync.
   */
  private async handleOnline(): Promise<void> {
    if (!this.context) return
    try {
      await resetErroredPhotosToPending(this.context.missionSessionId)
      this.nextAttemptAt.clear()
    } catch {
      // best-effort — si l'IDB est indispo, le polling rattrapera
    }
    await this.syncAll()
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
      // (P0-3) Plus d'exclusion définitive après N tentatives : on filtre
      // uniquement les inflight et le cooldown de backoff. Une photo qui a
      // beaucoup échoué reste éligible — son cooldown est juste plafonné.
      const eligibles = pending.filter((p) => {
        if (this.inflightIds.has(p.id)) return false
        const cooldown = this.nextAttemptAt.get(p.id) ?? 0
        return Date.now() >= cooldown
      })

      // Batch parallèle (BATCH_CONCURRENCY simultanés)
      for (let i = 0; i < eligibles.length; i += BATCH_CONCURRENCY) {
        const slice = eligibles.slice(i, i + BATCH_CONCURRENCY)
        await Promise.all(slice.map((p) => this.uploadOne(p, this.context?.orgId)))
      }
      await this.notifySubscribers()
    } finally {
      this.running = false
    }
  }

  /**
   * (P0-4) Sync GLOBAL — draine toutes les sessions ayant des photos en
   * attente, même si l'écran mission n'est pas monté. Appelé au montage de
   * l'app et au retour réseau via GlobalPhotosSync (dashboard layout).
   *
   * Réutilise inflightIds + nextAttemptAt + uploadOne pour ne pas dupliquer
   * une photo déjà en cours de traitement par le manager de session.
   *
   * @param orgId — organization_id courante (path Storage <orgId>/...).
   */
  async syncAllSessions(orgId: string): Promise<void> {
    if (typeof window === 'undefined') return
    if (!navigator.onLine) return
    if (this.globalRunning) return

    this.globalRunning = true
    try {
      const sessionIds = await getSessionsWithPendingPhotos()
      for (const sessionId of sessionIds) {
        const pending = await getPendingPhotos(sessionId)
        const eligibles = pending.filter((p) => {
          if (this.inflightIds.has(p.id)) return false
          const cooldown = this.nextAttemptAt.get(p.id) ?? 0
          return Date.now() >= cooldown
        })
        for (let i = 0; i < eligibles.length; i += BATCH_CONCURRENCY) {
          const slice = eligibles.slice(i, i + BATCH_CONCURRENCY)
          await Promise.all(slice.map((p) => this.uploadOne(p, orgId)))
        }
      }
      await this.notifySubscribers()
    } finally {
      this.globalRunning = false
    }
  }

  /**
   * (P0-4) Réarme global + sync de toutes les sessions au retour réseau.
   * Utilisé par GlobalPhotosSync sur l'événement `online`.
   */
  async resetAndSyncAllSessions(orgId: string): Promise<void> {
    if (typeof window === 'undefined') return
    try {
      await resetErroredPhotosToPending(null)
      this.nextAttemptAt.clear()
    } catch {
      // best-effort
    }
    await this.syncAllSessions(orgId)
  }

  /**
   * Upload + INSERT idempotent d'une photo.
   *
   * @param orgId — préfixe du path Storage. Si absent (cas improbable hors
   *   contexte), on saute la photo sans la marquer en erreur.
   */
  private async uploadOne(photo: PendingPhoto, orgId: string | undefined): Promise<void> {
    if (!orgId) return
    if (this.inflightIds.has(photo.id)) return
    this.inflightIds.add(photo.id)

    try {
      await markPhotoUploading(photo.id)
      await this.notifySubscribers()

      const supabase = createClient()
      // Path convention bucket mission-photos : <orgId>/<dossierId>/<photoId>.jpg
      // (compatible avec RLS storage existante : 1er segment = org_id)
      const storagePath = `${orgId}/${photo.dossier_id}/${photo.id}.jpg`

      // 1. Upload blob compressé vers Supabase Storage (upsert idempotent).
      // (P0-2) upsert:true → UPDATE storage.objects si l'objet existe déjà
      // (retry). La policy FOR UPDATE ajoutée par migration autorise ce cas.
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

      // 2. UPSERT row mission_photos via PostgREST (RLS auth.uid via cookie).
      // (P0-1) onConflict (mission_session_id, client_local_id) → un rejeu de
      // sync (réponse réseau perdue après un INSERT réussi) retombe sur la même
      // ligne au lieu de créer un doublon.
      const insertPayload = {
        mission_session_id: photo.mission_session_id,
        dossier_id: photo.dossier_id,
        room_id: photo.room_id,
        storage_path: storagePath,
        storage_bucket: 'mission-photos',
        thumbnail_base64: photo.thumbnail_base64,
        metadata: photo.metadata,
        // Clef d'idempotence = id local Dexie de la photo.
        client_local_id: photo.id,
      }

      const { data: inserted, error: insertErr } = await supabase
        // Cast localisé : la colonne client_local_id n'est pas encore dans les
        // types Database générés (régénérer après migration prod). Le `never`
        // suit le pattern déjà en place dans ce fichier pour mission_photos.
        .from('mission_photos' as never)
        .upsert(insertPayload as never, {
          onConflict: 'mission_session_id,client_local_id',
          ignoreDuplicates: false,
        })
        .select('id')
        .single()

      if (insertErr || !inserted) {
        throw new Error(`UPSERT mission_photos : ${insertErr?.message ?? 'no row returned'}`)
      }

      const serverId = (inserted as { id: string }).id
      await markPhotoSynced(photo.id, serverId, storagePath)
      this.nextAttemptAt.delete(photo.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      // (P0-5) On ne consomme/incrémente une tentative QUE sur un échec réseau
      // réel alors que navigator.onLine === true. Si on est repassé offline
      // pendant l'upload (sous-sol), on ne décompte pas : on remet simplement
      // la photo en attente sans pénalité, et on planifie un cooldown court.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this.nextAttemptAt.set(photo.id, Date.now() + BACKOFF_BASE_MS)
      } else {
        await markPhotoError(photo.id, msg)
        // Backoff exponentiel plafonné (P0-5) : 2s, 8s, 32s, 128s, … max 5 min.
        const nextAttempt = photo.upload_attempts + 1
        const delayMs = Math.min(BACKOFF_BASE_MS * 4 ** (nextAttempt - 1), BACKOFF_MAX_MS)
        this.nextAttemptAt.set(photo.id, Date.now() + delayMs)
      }
    } finally {
      this.inflightIds.delete(photo.id)
      await this.notifySubscribers()
    }
  }
}

export const photosSyncManager = new PhotosSyncManager()
