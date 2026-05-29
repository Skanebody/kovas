'use client'

/**
 * KOVAS — Mode mission tchat : sync manager pièces IA + items (BUG 3).
 *
 * Réplique le pattern `photos-sync-manager.ts` pour les pièces créées par l'IA
 * (id local `ai-...`) et leurs éléments rattachés.
 *
 * Flux :
 *   1. Lit getPendingAiRooms() → createRoomAction (RPC atomique create_or_get).
 *   2. Au succès : swap id local `ai-...` → UUID DB (markAiRoomSynced + callback
 *      composant pour mettre à jour le state React).
 *   3. Persiste ensuite TOUS les items en attente de cette pièce via
 *      createRoomItemAction (idempotent client_local_id) — c'est exactement ce
 *      qui manquait avant (BUG 3 : items jamais persistés car pièce restait `ai-...`).
 *   4. Retry au retour `online` + intervalle + au montage de l'app (global).
 *
 * Invariants réseau instable (parité photos) :
 *   - idempotence serveur (create_or_get_*) — pas de doublon au rejeu.
 *   - pas d'exclusion à vie — réarmement des `error` au `online`.
 *   - backoff exponentiel plafonné par pièce/item.
 *   - on ne consomme une tentative QUE sur échec alors qu'on est online.
 *
 * Le state React reste la source de vérité tant que la sync n'a pas abouti.
 *
 * Authority : CLAUDE.md §3 features 1 + 10 + brief BUG 3.
 */

import {
  createRoomAction,
  createRoomItemAction,
} from '@/app/dashboard/dossiers/[id]/mission/actions'
import {
  type PendingAiRoom,
  type PendingAiRoomItem,
  getPendingAiRooms,
  getPendingItemsForRoom,
  getServerRoomId,
  getSessionsWithPendingAiRooms,
  markAiItemError,
  markAiItemSynced,
  markAiItemSyncing,
  markAiRoomError,
  markAiRoomSynced,
  markAiRoomSyncing,
  resetErroredAiRoomsToPending,
  revertAiItemToPending,
  revertAiRoomToPending,
} from './ai-rooms-offline-store'

const POLL_INTERVAL_MS = 15_000
const BACKOFF_BASE_MS = 2_000
const BACKOFF_MAX_MS = 5 * 60_000

interface AiRoomsSyncContext {
  dossierId: string
  missionSessionId: string
}

/** Item kind admis par createRoomItemAction. */
type RoomItemKind = 'equipment' | 'observation' | 'measurement'
function isItemKind(k: string): k is RoomItemKind {
  return k === 'equipment' || k === 'observation' || k === 'measurement'
}

/**
 * Callback de swap d'une pièce IA : informe le composant que l'id local `ai-...`
 * vient d'être remplacé par l'UUID DB (pour mettre à jour le state + activeRoomId).
 */
export type OnRoomPersistedFn = (localId: string, serverRoomId: string) => void

export class AiRoomsSyncManager {
  private running = false
  private globalRunning = false
  private intervalId: ReturnType<typeof setInterval> | null = null
  private context: AiRoomsSyncContext | null = null
  private onlineListener: (() => void) | null = null
  private inflight = new Set<string>()
  private nextAttemptAt = new Map<string, number>()
  private roomListeners = new Set<OnRoomPersistedFn>()

  start(context: AiRoomsSyncContext): void {
    if (typeof window === 'undefined') return
    if (this.context && this.context.missionSessionId === context.missionSessionId) {
      return
    }
    this.stop()
    this.context = context

    this.onlineListener = () => {
      void this.handleOnline()
    }
    window.addEventListener('online', this.onlineListener)

    void this.syncAll()
    this.intervalId = setInterval(() => {
      if (navigator.onLine) void this.syncAll()
    }, POLL_INTERVAL_MS)
  }

  private async handleOnline(): Promise<void> {
    if (!this.context) return
    try {
      await resetErroredAiRoomsToPending(this.context.missionSessionId)
      this.nextAttemptAt.clear()
    } catch {
      // best-effort
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
    this.inflight.clear()
    this.nextAttemptAt.clear()
  }

  /** S'abonne aux swaps de pièce IA (id local → UUID DB). */
  onRoomPersisted(fn: OnRoomPersistedFn): () => void {
    this.roomListeners.add(fn)
    return () => {
      this.roomListeners.delete(fn)
    }
  }

  private notifyRoomPersisted(localId: string, serverRoomId: string): void {
    for (const fn of this.roomListeners) fn(localId, serverRoomId)
  }

  /** Force un sync immédiat (depuis composant après ajout pièce/item). */
  async kick(): Promise<void> {
    await this.syncAll()
  }

  async syncAll(): Promise<void> {
    if (this.running) return
    if (typeof window === 'undefined') return
    if (!navigator.onLine) return
    if (!this.context) return

    this.running = true
    try {
      await this.drainSession(this.context.missionSessionId)
    } finally {
      this.running = false
    }
  }

  /** Sync GLOBAL — toutes les sessions, même écran mission fermé (BUG 3). */
  async syncAllSessions(): Promise<void> {
    if (typeof window === 'undefined') return
    if (!navigator.onLine) return
    if (this.globalRunning) return

    this.globalRunning = true
    try {
      const sessionIds = await getSessionsWithPendingAiRooms()
      for (const sessionId of sessionIds) {
        await this.drainSession(sessionId)
      }
    } finally {
      this.globalRunning = false
    }
  }

  async resetAndSyncAllSessions(): Promise<void> {
    if (typeof window === 'undefined') return
    try {
      await resetErroredAiRoomsToPending(null)
      this.nextAttemptAt.clear()
    } catch {
      // best-effort
    }
    await this.syncAllSessions()
  }

  /**
   * Draine une session : persiste les pièces pending puis, pour CHAQUE pièce
   * (pending nouvellement synced OU déjà synced avec items restants), persiste
   * ses items en attente.
   */
  private async drainSession(sessionId: string): Promise<void> {
    const rooms = await getPendingAiRooms(sessionId)
    for (const room of this.filterEligible(rooms, (r) => r.local_id)) {
      await this.persistRoom(room)
    }
    // Après persistence des pièces, on draine les items des pièces synced. Une
    // pièce peut être synced mais avoir des items en attente (ex : items ajoutés
    // offline après le swap, ou app redémarrée). On reparcourt toutes les pièces
    // pending d'origine + on utilise getServerRoomId pour récupérer l'UUID.
    const allRoomLocalIds = new Set(rooms.map((r) => r.local_id))
    for (const localId of allRoomLocalIds) {
      const serverRoomId = await getServerRoomId(localId)
      if (serverRoomId) {
        await this.persistItemsForRoom(localId, serverRoomId)
      }
    }
  }

  private filterEligible<T>(rows: T[], idOf: (row: T) => string): T[] {
    return rows.filter((row) => {
      const id = idOf(row)
      if (this.inflight.has(id)) return false
      const cooldown = this.nextAttemptAt.get(id) ?? 0
      return Date.now() >= cooldown
    })
  }

  private async persistRoom(room: PendingAiRoom): Promise<void> {
    if (this.inflight.has(room.local_id)) return
    this.inflight.add(room.local_id)
    try {
      await markAiRoomSyncing(room.local_id)
      const res = await createRoomAction(room.dossier_id, room.name)
      if ('roomId' in res) {
        await markAiRoomSynced(room.local_id, res.roomId)
        this.nextAttemptAt.delete(room.local_id)
        // Informe le composant du swap id local → UUID DB.
        this.notifyRoomPersisted(room.local_id, res.roomId)
        // Persiste immédiatement les items en attente de cette pièce.
        await this.persistItemsForRoom(room.local_id, res.roomId)
      } else {
        throw new Error(res.error)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this.nextAttemptAt.set(room.local_id, Date.now() + BACKOFF_BASE_MS)
        await revertAiRoomToPending(room.local_id).catch(() => undefined)
      } else {
        await markAiRoomError(room.local_id, msg)
        const next = room.attempts + 1
        const delayMs = Math.min(BACKOFF_BASE_MS * 4 ** (next - 1), BACKOFF_MAX_MS)
        this.nextAttemptAt.set(room.local_id, Date.now() + delayMs)
      }
    } finally {
      this.inflight.delete(room.local_id)
    }
  }

  private async persistItemsForRoom(roomLocalId: string, serverRoomId: string): Promise<void> {
    const items = await getPendingItemsForRoom(roomLocalId)
    for (const item of this.filterEligible(items, (it) => it.id)) {
      await this.persistItem(item, serverRoomId)
    }
  }

  private async persistItem(item: PendingAiRoomItem, serverRoomId: string): Promise<void> {
    if (this.inflight.has(item.id)) return
    if (!isItemKind(item.kind)) {
      // Kind inattendu (donnée corrompue) → on le neutralise sans bloquer.
      await markAiItemSynced(item.id)
      return
    }
    this.inflight.add(item.id)
    try {
      await markAiItemSyncing(item.id)
      const res = await createRoomItemAction(
        serverRoomId,
        item.kind,
        item.label,
        item.data,
        item.id,
      )
      if ('itemId' in res) {
        await markAiItemSynced(item.id)
        this.nextAttemptAt.delete(item.id)
      } else {
        throw new Error(res.error)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this.nextAttemptAt.set(item.id, Date.now() + BACKOFF_BASE_MS)
        await revertAiItemToPending(item.id).catch(() => undefined)
      } else {
        await markAiItemError(item.id, msg)
        const next = item.attempts + 1
        const delayMs = Math.min(BACKOFF_BASE_MS * 4 ** (next - 1), BACKOFF_MAX_MS)
        this.nextAttemptAt.set(item.id, Date.now() + delayMs)
      }
    } finally {
      this.inflight.delete(item.id)
    }
  }
}

export const aiRoomsSyncManager = new AiRoomsSyncManager()
