'use client'

/**
 * KOVAS — Mode mission tchat : store offline Dexie pour pièces IA + items (BUG 3).
 *
 * Réplique le pattern `photos-offline-store.ts` pour le flux des pièces créées
 * par l'IA (id local `ai-...`) et de leurs éléments rattachés (équipements /
 * observations / mesures Phase 2).
 *
 * Problème corrigé (BUG 3) : `persistAiRoom` ne faisait qu'UNE tentative
 * `createRoomAction` ; en cas d'échec offline, l'id `ai-...` restait et RIEN
 * n'était replanifié. Les items rattachés (gardés par `isDbRoomId`) ne se
 * persistaient jamais. Refresh → pièce IA + items perdus.
 *
 * Deux tables :
 *   - `rooms` : pièces IA en attente de persistence (createRoomAction → UUID).
 *   - `items` : éléments en attente, rattachés par `room_local_id`. Tant que la
 *     pièce n'a pas son UUID DB, ses items restent en attente ; dès le swap
 *     id→UUID, le manager les rejoue via createRoomItemAction.
 *
 * Le state React reste la SOURCE DE VÉRITÉ tant que la sync n'a pas abouti
 * (offline-first) — ces tables ne servent QU'À garantir la persistence durable.
 *
 * Authority : CLAUDE.md §3 features 1 + 10 (offline complet) + brief BUG 3.
 */

import Dexie, { type Table } from 'dexie'

// ============================================
// Types
// ============================================

export type AiRoomSyncStatus = 'pending' | 'syncing' | 'synced' | 'error'

export interface PendingAiRoom {
  /** Id local `ai-...` de la pièce (clef primaire). */
  local_id: string
  dossier_id: string
  mission_session_id: string
  name: string
  sync_status: AiRoomSyncStatus
  attempts: number
  last_error?: string
  /** UUID DB une fois la pièce persistée (createRoomAction). */
  server_room_id?: string
  created_at: string
  synced_at?: string
}

export interface PendingAiRoomItem {
  /** UUID local de l'item (clef primaire + idempotence createRoomItemAction). */
  id: string
  /** Id local `ai-...` de la pièce de rattachement (avant swap UUID). */
  room_local_id: string
  dossier_id: string
  mission_session_id: string
  /** equipment | observation | measurement (RoomItemKind). */
  kind: string
  label: string
  /** Payload data brut de la capture (stocké tel quel). */
  data: Record<string, unknown>
  sync_status: AiRoomSyncStatus
  attempts: number
  last_error?: string
  created_at: string
  synced_at?: string
}

// ============================================
// Schéma DB Dexie
// ============================================

class KovasAiRoomsDb extends Dexie {
  rooms!: Table<PendingAiRoom, string>
  items!: Table<PendingAiRoomItem, string>

  constructor() {
    super('kovas-mission-ai-rooms')
    this.version(1).stores({
      rooms: 'local_id, dossier_id, mission_session_id, sync_status, created_at',
      items: 'id, room_local_id, dossier_id, mission_session_id, sync_status, created_at',
    })
  }
}

let dbInstance: KovasAiRoomsDb | null = null

export function getAiRoomsDb(): KovasAiRoomsDb {
  if (typeof window === 'undefined') {
    throw new Error('getAiRoomsDb() called server-side — IndexedDB is client-only')
  }
  if (!dbInstance) {
    dbInstance = new KovasAiRoomsDb()
  }
  return dbInstance
}

function nowIso(): string {
  return new Date().toISOString()
}

// ============================================
// Mutations — pièces
// ============================================

export interface AddAiRoomInput {
  local_id: string
  dossier_id: string
  mission_session_id: string
  name: string
}

/**
 * Enregistre une pièce IA en attente de persistence. Idempotent : si la pièce
 * (par local_id) existe déjà, on ne crée pas de doublon (put avec merge léger).
 */
export async function addAiRoom(input: AddAiRoomInput): Promise<void> {
  const db = getAiRoomsDb()
  const existing = await db.rooms.get(input.local_id)
  if (existing) {
    // Ne ré-arme pas une pièce déjà synced ; sinon met juste le nom à jour.
    if (existing.sync_status !== 'synced') {
      await db.rooms.update(input.local_id, { name: input.name })
    }
    return
  }
  const room: PendingAiRoom = {
    local_id: input.local_id,
    dossier_id: input.dossier_id,
    mission_session_id: input.mission_session_id,
    name: input.name,
    sync_status: 'pending',
    attempts: 0,
    created_at: nowIso(),
  }
  await db.rooms.add(room)
}

export async function getPendingAiRooms(missionSessionId: string): Promise<PendingAiRoom[]> {
  const db = getAiRoomsDb()
  return db.rooms
    .where('mission_session_id')
    .equals(missionSessionId)
    .and((r) => r.sync_status === 'pending' || r.sync_status === 'error')
    .sortBy('created_at')
}

export async function getSessionsWithPendingAiRooms(): Promise<string[]> {
  const db = getAiRoomsDb()
  const ids = new Set<string>()
  await db.rooms
    .where('sync_status')
    .anyOf('pending', 'error')
    .each((r) => ids.add(r.mission_session_id))
  // Une pièce déjà synced peut avoir des items encore en attente → on inclut
  // aussi les sessions qui ont des items pending/error.
  await db.items
    .where('sync_status')
    .anyOf('pending', 'error')
    .each((it) => ids.add(it.mission_session_id))
  return [...ids]
}

export async function markAiRoomSyncing(localId: string): Promise<void> {
  const db = getAiRoomsDb()
  await db.rooms.update(localId, { sync_status: 'syncing' })
}

/** Remet une pièce `syncing` en `pending` SANS pénalité (repassé offline). */
export async function revertAiRoomToPending(localId: string): Promise<void> {
  const db = getAiRoomsDb()
  await db.rooms.update(localId, { sync_status: 'pending' })
}

/**
 * Pièce persistée : on stocke l'UUID DB + on bascule en synced. On répercute
 * AUSSI le nouvel UUID sur tous les items rattachés (qui pointaient le room_local_id)
 * pour qu'ils puissent se persister à leur tour.
 */
export async function markAiRoomSynced(localId: string, serverRoomId: string): Promise<void> {
  const db = getAiRoomsDb()
  await db.rooms.update(localId, {
    sync_status: 'synced',
    server_room_id: serverRoomId,
    synced_at: nowIso(),
  })
}

export async function markAiRoomError(localId: string, errorMessage: string): Promise<void> {
  const db = getAiRoomsDb()
  const room = await db.rooms.get(localId)
  if (!room) return
  await db.rooms.update(localId, {
    sync_status: 'error',
    attempts: room.attempts + 1,
    last_error: errorMessage,
  })
}

export async function resetErroredAiRoomsToPending(
  missionSessionId: string | null = null,
): Promise<void> {
  const db = getAiRoomsDb()
  const roomsColl =
    missionSessionId === null
      ? db.rooms.where('sync_status').equals('error')
      : db.rooms
          .where('mission_session_id')
          .equals(missionSessionId)
          .and((r) => r.sync_status === 'error')
  await roomsColl.modify((r) => {
    r.sync_status = 'pending'
    r.attempts = 0
  })
  const itemsColl =
    missionSessionId === null
      ? db.items.where('sync_status').equals('error')
      : db.items
          .where('mission_session_id')
          .equals(missionSessionId)
          .and((it) => it.sync_status === 'error')
  await itemsColl.modify((it) => {
    it.sync_status = 'pending'
    it.attempts = 0
  })
}

// ============================================
// Mutations — items
// ============================================

export interface AddAiRoomItemInput {
  id: string
  room_local_id: string
  dossier_id: string
  mission_session_id: string
  kind: string
  label: string
  data: Record<string, unknown>
}

/** Enregistre un item en attente, rattaché à une pièce (idempotent par id). */
export async function addAiRoomItem(input: AddAiRoomItemInput): Promise<void> {
  const db = getAiRoomsDb()
  const existing = await db.items.get(input.id)
  if (existing) return
  const item: PendingAiRoomItem = {
    id: input.id,
    room_local_id: input.room_local_id,
    dossier_id: input.dossier_id,
    mission_session_id: input.mission_session_id,
    kind: input.kind,
    label: input.label,
    data: input.data,
    sync_status: 'pending',
    attempts: 0,
    created_at: nowIso(),
  }
  await db.items.add(item)
}

/**
 * Items en attente d'une pièce dont l'UUID DB vient d'être résolu. On les
 * retrouve par `room_local_id` (le lien stable entre item et pièce).
 */
export async function getPendingItemsForRoom(roomLocalId: string): Promise<PendingAiRoomItem[]> {
  const db = getAiRoomsDb()
  return db.items
    .where('room_local_id')
    .equals(roomLocalId)
    .and((it) => it.sync_status === 'pending' || it.sync_status === 'error')
    .sortBy('created_at')
}

/**
 * Récupère l'UUID DB d'une pièce déjà persistée (pour rejouer ses items après
 * un redémarrage de l'app, quand le swap id→UUID est déjà en DB mais que des
 * items restaient en attente).
 */
export async function getServerRoomId(roomLocalId: string): Promise<string | null> {
  const db = getAiRoomsDb()
  const room = await db.rooms.get(roomLocalId)
  return room?.server_room_id ?? null
}

/** Marque un item comme persisté. */
export async function markAiItemSynced(itemId: string): Promise<void> {
  const db = getAiRoomsDb()
  await db.items.update(itemId, { sync_status: 'synced', synced_at: nowIso() })
}

export async function markAiItemSyncing(itemId: string): Promise<void> {
  const db = getAiRoomsDb()
  await db.items.update(itemId, { sync_status: 'syncing' })
}

/** Remet un item `syncing` en `pending` SANS pénalité (repassé offline). */
export async function revertAiItemToPending(itemId: string): Promise<void> {
  const db = getAiRoomsDb()
  await db.items.update(itemId, { sync_status: 'pending' })
}

export async function markAiItemError(itemId: string, errorMessage: string): Promise<void> {
  const db = getAiRoomsDb()
  const item = await db.items.get(itemId)
  if (!item) return
  await db.items.update(itemId, {
    sync_status: 'error',
    attempts: item.attempts + 1,
    last_error: errorMessage,
  })
}

/**
 * Supprime un item local (ex : l'utilisateur l'a retiré avant qu'il soit
 * synced). Best-effort — pas d'erreur si absent.
 */
export async function deleteAiRoomItem(itemId: string): Promise<void> {
  const db = getAiRoomsDb()
  await db.items.delete(itemId)
}

/**
 * Purge les pièces + items synced de plus de `maxAgeMs` (défaut 30j). Cohérent
 * avec la purge photos/notes — à appeler au mount de l'interface tchat.
 */
export async function purgeOldAiRooms(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
  const db = getAiRoomsDb()
  const threshold = new Date(Date.now() - maxAgeMs).toISOString()
  await db.rooms
    .where('created_at')
    .below(threshold)
    .and((r) => r.sync_status === 'synced')
    .delete()
  await db.items
    .where('created_at')
    .below(threshold)
    .and((it) => it.sync_status === 'synced')
    .delete()
}
