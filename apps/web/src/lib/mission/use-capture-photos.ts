'use client'

/**
 * KOVAS — Hook React du carrousel mode terrain Capture-First (V1.5 iteration 2).
 *
 * Source unique : IndexedDB locale (Dexie). Itération 2 ne montre QUE les
 * photos de la session courante (pile locale). Les photos serveur déjà
 * uploadées d'anciennes sessions seront chargées séparément en itération 7
 * (cockpit progression).
 *
 * Stratégie :
 *   - useLiveQuery (dexie-react-hooks) sur missionDb.photos filtrée dossierId
 *   - URL.createObjectURL pour les vignettes (thumbnailBlob > blob fallback)
 *   - cleanup URL.revokeObjectURL au unmount + au changement de liste
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useRef } from 'react'
import { getMissionDb } from './local-storage-queue'
import { captureSyncManager } from './sync-manager'
import type { QueuedPhotoOperation, SyncOperationStatus } from './types'

export type DisplaySyncStatus = 'pending_upload' | 'uploaded' | 'failed'

export interface DisplayPhoto {
  /** Toujours le local id (server id consultable via serverPhotoId). */
  id: string
  source: 'local'
  thumbnailUrl: string
  serverPhotoId: string | null
  roomId: string | null
  roomName: string | null
  capturedAt: number
  isBlurry: boolean
  width: number
  height: number
  sizeBytes: number
  hasVoiceNote: boolean
  hasTextNote: boolean
  syncStatus: DisplaySyncStatus
  lastError: string | null
}

export interface UseCapturePhotosResult {
  photos: DisplayPhoto[]
  pendingCount: number
  failedCount: number
  uploadedCount: number
  retry: (localId: string) => Promise<void>
  retryAll: () => Promise<void>
}

const SYNC_STATUS_MAP: Record<SyncOperationStatus, DisplaySyncStatus> = {
  pending_upload: 'pending_upload',
  uploaded: 'uploaded',
  failed: 'failed',
}

export function useCapturePhotos(
  dossierId: string,
  roomFilter?: string | null,
): UseCapturePhotosResult {
  // Map<localId, objectURL> — nettoyé proprement pour éviter les leaks
  // (un objectURL non révoqué garde le blob en mémoire jusqu'au refresh).
  const urlCacheRef = useRef<Map<string, string>>(new Map())

  const rows = useLiveQuery(async () => {
    const db = getMissionDb()
    const list = await db.photos.where('dossierId').equals(dossierId).sortBy('createdAt')
    if (roomFilter === undefined) return list
    return list.filter((p) => p.roomId === roomFilter)
  }, [dossierId, roomFilter])

  const photos = useMemo<DisplayPhoto[]>(() => {
    if (!rows) return []
    return rows.map((p) => mapToDisplay(p, urlCacheRef.current))
  }, [rows])

  // Cleanup des objectURL obsolètes (photos supprimées de la liste)
  useEffect(() => {
    const aliveIds = new Set(photos.map((p) => p.id))
    const cache = urlCacheRef.current
    for (const [id, url] of cache.entries()) {
      if (!aliveIds.has(id)) {
        URL.revokeObjectURL(url)
        cache.delete(id)
      }
    }
  }, [photos])

  // Cleanup au unmount
  useEffect(() => {
    const cache = urlCacheRef.current
    return () => {
      for (const url of cache.values()) {
        URL.revokeObjectURL(url)
      }
      cache.clear()
    }
  }, [])

  const pendingCount = photos.filter((p) => p.syncStatus === 'pending_upload').length
  const failedCount = photos.filter((p) => p.syncStatus === 'failed').length
  const uploadedCount = photos.filter((p) => p.syncStatus === 'uploaded').length

  async function retry(localId: string): Promise<void> {
    await captureSyncManager.retryPhoto(localId)
  }

  async function retryAll(): Promise<void> {
    const failed = photos.filter((p) => p.syncStatus === 'failed')
    for (const p of failed) {
      await captureSyncManager.retryPhoto(p.id)
    }
  }

  return {
    photos,
    pendingCount,
    failedCount,
    uploadedCount,
    retry,
    retryAll,
  }
}

// ============================================
// Helpers internes
// ============================================

function mapToDisplay(p: QueuedPhotoOperation, cache: Map<string, string>): DisplayPhoto {
  let url = cache.get(p.id)
  if (!url) {
    const blob = p.thumbnailBlob ?? p.blob
    url = URL.createObjectURL(blob)
    cache.set(p.id, url)
  }
  return {
    id: p.id,
    source: 'local',
    thumbnailUrl: url,
    serverPhotoId: p.serverPhotoId ?? null,
    roomId: p.roomId,
    roomName: p.roomName,
    capturedAt: p.capturedAt,
    isBlurry: p.isBlurry,
    width: p.width,
    height: p.height,
    sizeBytes: p.sizeBytes,
    hasVoiceNote: false, // iteration 4
    hasTextNote: false, // iteration 4
    syncStatus: SYNC_STATUS_MAP[p.syncStatus],
    lastError: p.lastError,
  }
}
