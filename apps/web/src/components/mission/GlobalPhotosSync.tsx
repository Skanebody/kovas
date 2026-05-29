'use client'

/**
 * KOVAS — Sync global des photos mission en arrière-plan (P0-4).
 *
 * Problème corrigé : le PhotosSyncManager ne tournait QUE tant que l'écran
 * mission tchat était monté. Une photo capturée en sous-sol hier, mais dont
 * l'écran a été quitté avant le retour réseau, restait coincée en `pending`
 * dans IndexedDB jusqu'à ce que le diagnostiqueur rouvre EXACTEMENT cette
 * mission — soit potentiellement jamais.
 *
 * Ce composant, monté en permanence dans le layout dashboard, draine TOUTES
 * les sessions ayant des photos en attente :
 *   - au montage de l'app (si en ligne et photos pending) ;
 *   - à chaque retour réseau (`online`), avec réarmement des photos en erreur.
 *
 * Scope volontairement limité : ce n'est PAS le vrai Background Sync API (qui
 * nécessiterait un drain depuis le Service Worker même app fermée — voir TODO
 * dans apps/web/src/app/sw.ts, `syncOfflineQueue`). Ici, le sync ne tourne que
 * pendant que l'onglet/PWA KOVAS est ouvert (au premier plan ou en arrière-
 * plan d'onglet). C'est suffisant pour le cas terrain le plus courant :
 * le diagnostiqueur garde l'app ouverte en remontant du sous-sol.
 *
 * Authority : CLAUDE.md §3 features 2 + 10 (offline complet) + MISSION-B.
 */

import { purgeOldAiRooms } from '@/lib/mission/ai-rooms-offline-store'
import { aiRoomsSyncManager } from '@/lib/mission/ai-rooms-sync-manager'
import { purgeOldNotes } from '@/lib/mission/mission-notes-offline-store'
import { notesSyncManager } from '@/lib/mission/notes-sync-manager'
import { purgeOldPhotos } from '@/lib/mission/photos-offline-store'
import { photosSyncManager } from '@/lib/mission/photos-sync-manager'
import { useEffect } from 'react'

interface GlobalPhotosSyncProps {
  /** organization_id courante — préfixe du path Storage <orgId>/... */
  orgId: string
}

/**
 * BUG 1/2/3 : ce composant draine désormais NON SEULEMENT les photos, mais
 * AUSSI les notes texte/vocal (mission-notes-offline-store) et les pièces IA +
 * items (ai-rooms-offline-store) en attente, avec la même politique : drain au
 * montage + réarmement au retour réseau, toutes sessions confondues. Le pattern
 * est identique aux photos (cf. JSDoc d'origine ci-dessous), seul le périmètre
 * s'élargit aux deux nouvelles files offline.
 */
export function GlobalPhotosSync({ orgId }: GlobalPhotosSyncProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!orgId) return

    // 1. Drain initial au montage de l'app (si en ligne).
    void photosSyncManager.syncAllSessions(orgId)
    void notesSyncManager.syncAllSessions()
    void aiRoomsSyncManager.syncAllSessions()

    // PERF-4 : purge best-effort des éléments offline déjà syncés > 30j.
    // Idempotent + ne supprime QUE les rows `synced` (les pending/error sont
    // conservés). Appelé une seule fois au montage de l'app pour empêcher le
    // ballonnement IndexedDB sur les sessions longues / appareils milieu de gamme.
    void purgeOldPhotos().catch(() => undefined)
    void purgeOldNotes().catch(() => undefined)
    void purgeOldAiRooms().catch(() => undefined)

    // 2. Au retour réseau : réarme les éléments en erreur (toutes sessions) puis
    //    relance un drain global pour chaque file offline.
    const onOnline = () => {
      void photosSyncManager.resetAndSyncAllSessions(orgId)
      void notesSyncManager.resetAndSyncAllSessions()
      void aiRoomsSyncManager.resetAndSyncAllSessions()
    }
    window.addEventListener('online', onOnline)

    return () => {
      window.removeEventListener('online', onOnline)
    }
  }, [orgId])

  // Composant purement comportemental — aucun rendu.
  return null
}
