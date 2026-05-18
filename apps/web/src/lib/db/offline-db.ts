/**
 * KOVAS offline DB — IndexedDB via Dexie.
 * Cf. /docs/pwa-pivot-decision.md §5 — Stack technique PWA (remplace op-sqlite + Drizzle ORM)
 */

import Dexie, { type Table } from 'dexie'

export interface OfflineMission {
  id: string
  organizationId: string
  reference: string
  type: string
  status: string
  scheduledAt?: Date
  data: Record<string, unknown>
  syncStatus: 'pending' | 'syncing' | 'synced' | 'conflict'
  updatedAt: Date
}

export interface OfflinePhoto {
  id: string
  missionId: string
  blob: Blob
  exifData?: Record<string, unknown>
  syncStatus: 'pending' | 'syncing' | 'synced'
  capturedAt: Date
}

export interface OfflineVoiceNote {
  id: string
  missionId: string
  blob: Blob
  durationSeconds: number
  transcript?: string
  syncStatus: 'pending' | 'transcribing' | 'transcribed' | 'synced'
  capturedAt: Date
}

export interface OutboxEntry {
  id?: number
  operation: 'insert' | 'update' | 'delete'
  table: string
  rowId: string
  payload: Record<string, unknown>
  retries: number
  createdAt: Date
}

class KovasOfflineDB extends Dexie {
  missions!: Table<OfflineMission>
  photos!: Table<OfflinePhoto>
  voiceNotes!: Table<OfflineVoiceNote>
  outbox!: Table<OutboxEntry>

  constructor() {
    super('kovas-offline')
    this.version(1).stores({
      missions: 'id, organizationId, syncStatus, updatedAt',
      photos: 'id, missionId, syncStatus, capturedAt',
      voiceNotes: 'id, missionId, syncStatus, capturedAt',
      outbox: '++id, table, rowId, createdAt',
    })
  }
}

export const offlineDb = new KovasOfflineDB()
