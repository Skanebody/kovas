'use client'

/**
 * KOVAS — Hook React de comptage live photos pour Context Bar (MISSION-B).
 *
 * Subscribe Dexie via useLiveQuery — réactif aux insertions/suppressions.
 * Retourne {0} jusqu'à ce que la DB soit prête ou en SSR.
 *
 * Authority : CLAUDE.md §3 features 2 + 10.
 */

import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import {
  type PhotoSyncStatus,
  type PhotosSyncSnapshot,
  getPhotosDb,
  getSyncSnapshot,
} from './photos-offline-store'
import { photosSyncManager } from './photos-sync-manager'

/**
 * Compteur photos par session — réactif aux changements IndexedDB.
 * Retourne 0 en SSR ou avant init.
 */
export function useMissionPhotosCount(missionSessionId: string | null): number {
  const count = useLiveQuery(async () => {
    if (!missionSessionId) return 0
    if (typeof window === 'undefined') return 0
    try {
      const db = getPhotosDb()
      return db.photos.where('mission_session_id').equals(missionSessionId).count()
    } catch {
      return 0
    }
  }, [missionSessionId])
  return count ?? 0
}

/**
 * Snapshot complet { pending, uploading, synced, errors, total }.
 * Branché sur PhotosSyncManager.subscribe pour rafraîchir à chaque sync.
 */
export function useMissionPhotosSyncStatus(missionSessionId: string | null): PhotosSyncSnapshot {
  const [snap, setSnap] = useState<PhotosSyncSnapshot>({
    pending: 0,
    uploading: 0,
    synced: 0,
    errors: 0,
    total: 0,
  })

  useEffect(() => {
    if (!missionSessionId) return
    if (typeof window === 'undefined') return

    // Snapshot initial
    void getSyncSnapshot(missionSessionId)
      .then(setSnap)
      .catch(() => undefined)

    // S'abonne aux updates du manager
    const unsubscribe = photosSyncManager.subscribe(setSnap)
    return unsubscribe
  }, [missionSessionId])

  return snap
}

/**
 * Statut de sync live d'une seule photo (par id local) — pour badge overlay
 * dans le chat. Retourne undefined si la photo n'existe pas (ou hors window).
 */
export function usePhotoSyncStatus(localId: string | null): PhotoSyncStatus | undefined {
  return useLiveQuery(async () => {
    if (!localId) return undefined
    if (typeof window === 'undefined') return undefined
    try {
      const db = getPhotosDb()
      const p = await db.photos.get(localId)
      return p?.sync_status
    } catch {
      return undefined
    }
  }, [localId])
}
