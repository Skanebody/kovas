'use client'

import Dexie, { type Table } from 'dexie'

/**
 * KOVAS Sync DB — IndexedDB via Dexie (CLAUDE.md §3 feature #10).
 *
 * Trois tables :
 * 1. mutations : queue FIFO des actions à synchroniser
 * 2. blobs : photos et audio binaires (séparés pour optimiser le stockage)
 * 3. conflicts : conflits détectés au sync, à résoudre manuellement
 *
 * Stratégie : last-write-wins par défaut, log dans `conflicts` pour audit.
 * UI bottom sheet uniquement si conflit critique (champs métier divergents).
 */

export type MutationStatus = 'pending' | 'in_flight' | 'failed' | 'done'

export type MutationKind =
  /** Mutations queueisables (CLAUDE.md §3 #10) */
  | 'create_dossier'
  | 'update_dossier'
  | 'create_mission'
  | 'update_mission_status'
  | 'create_room'
  | 'update_room'
  | 'delete_room'
  | 'add_photo'
  | 'delete_photo'
  | 'add_voice_note'
  | 'delete_voice_note'
  | 'toggle_checklist_item'
  | 'update_owner_document'

export interface MutationRow {
  /** Auto-incrément Dexie */
  id?: number
  /** UUID client pour idempotence côté serveur */
  clientId: string
  /** Type de mutation */
  kind: MutationKind
  /** Payload sérialisable (sans blobs) */
  payload: Record<string, unknown>
  /** ID du blob lié dans `blobs` (photo/audio) */
  blobId?: number
  /** Organization ID pour partitionnement RLS */
  organizationId: string
  /** Status courant */
  status: MutationStatus
  /** Nombre de retries */
  attempts: number
  /** Erreur du dernier essai si failed */
  lastError?: string
  /** Timestamp client (pour conflict resolution last-write-wins) */
  createdAt: number
  /** Timestamp dernière tentative */
  lastAttemptAt?: number
}

export interface BlobRow {
  id?: number
  /** Type MIME (image/jpeg, audio/webm, etc.) */
  mimeType: string
  /** Blob binaire */
  data: Blob
  /** Nom de fichier original */
  filename: string
  /** Taille en bytes */
  size: number
  /** Timestamp création */
  createdAt: number
}

export interface ConflictRow {
  id?: number
  /** Mutation qui a généré le conflit */
  mutationClientId: string
  /** Type de conflit */
  kind: 'last_write_wins_overwrite' | 'server_rejected' | 'permission_denied'
  /** Données version locale */
  localData: Record<string, unknown>
  /** Données version serveur */
  serverData: Record<string, unknown>
  /** Timestamp détection */
  detectedAt: number
  /** Résolu par l'utilisateur ? */
  resolved: boolean
  /** Choix utilisateur si résolu : 'local' | 'server' | 'merged' */
  resolution?: 'local' | 'server' | 'merged'
}

class KovasSyncDB extends Dexie {
  mutations!: Table<MutationRow, number>
  blobs!: Table<BlobRow, number>
  conflicts!: Table<ConflictRow, number>

  constructor() {
    super('kovas_sync_v1')
    this.version(1).stores({
      mutations: '++id, clientId, organizationId, status, kind, createdAt',
      blobs: '++id, createdAt',
      conflicts: '++id, mutationClientId, resolved, detectedAt',
    })
  }
}

let dbInstance: KovasSyncDB | null = null

/**
 * Singleton DB — ne s'instancie que côté client (window check).
 * Server components doivent jamais l'appeler.
 */
export function getSyncDB(): KovasSyncDB {
  if (typeof window === 'undefined') {
    throw new Error('getSyncDB() called server-side — sync DB is client-only')
  }
  if (!dbInstance) {
    dbInstance = new KovasSyncDB()
  }
  return dbInstance
}

/**
 * Génère un client ID stable pour idempotence (crypto.randomUUID).
 */
export function generateClientId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `kovas-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}
