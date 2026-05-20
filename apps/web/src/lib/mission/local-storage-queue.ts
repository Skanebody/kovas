'use client'

/**
 * KOVAS — Queue locale IndexedDB du mode Capture-First (V1.5 iteration 1).
 *
 * Authority : CLAUDE.md §3 feature #10 (offline complet + queue mutations).
 *
 * Cette queue est COMPLÉMENTAIRE de `lib/sync/db.ts` (KovasSyncDB) :
 * - `lib/sync/db.ts` reste la queue générique du mode classique (mutations CRUD + blobs partagés).
 * - Ici, on a une DB séparée optimisée pour le pattern Capture-First : photos en flux rapide,
 *   notes vocales + texte attachées à la photo locale, opérations indexées par dossier.
 *
 * Approche : nouvelle DB Dexie `kovas_mission_capture_v1` (Dexie est déjà installé : v4.0.10).
 *
 * Lifecycle :
 *   1. user tap photo → enqueuePhoto() → blob stocké local + statut 'pending_upload'
 *   2. user enregistre note vocale dans fenêtre 3-4s → enqueueVoiceNote(attachedLocalPhotoId)
 *   3. service worker (itération 2) lit getPendingPhotos() / getPendingVoiceNotes() / getPendingTextNotes()
 *      et synchronise vers Supabase puis appelle markXxxUploaded(localId, serverId)
 */

import Dexie, { type Table } from 'dexie'
import type {
  PhotoDeviceInfo,
  QueuedMutationOperation,
  QueuedPhotoOperation,
  QueuedTextNoteOperation,
  QueuedVoiceNoteOperation,
  SyncOperationStatus,
} from './types'

// ============================================
// Schéma DB
// ============================================

class KovasMissionCaptureDB extends Dexie {
  photos!: Table<QueuedPhotoOperation, string>
  voiceNotes!: Table<QueuedVoiceNoteOperation, string>
  textNotes!: Table<QueuedTextNoteOperation, string>
  mutations!: Table<QueuedMutationOperation, string>

  constructor() {
    super('kovas_mission_capture_v1')
    this.version(1).stores({
      // PK = id (UUID local). Indexes secondaires utiles.
      photos: 'id, dossierId, roomId, syncStatus, createdAt',
      voiceNotes: 'id, dossierId, attachedLocalPhotoId, syncStatus, createdAt',
      textNotes: 'id, dossierId, attachedLocalPhotoId, syncStatus, createdAt',
      mutations: 'id, dossierId, syncStatus, createdAt',
    })
  }
}

let dbInstance: KovasMissionCaptureDB | null = null

/** Singleton — instancie uniquement côté client (window check). */
export function getMissionDb(): KovasMissionCaptureDB {
  if (typeof window === 'undefined') {
    throw new Error('getMissionDb() called server-side — Capture-First DB is client-only')
  }
  if (!dbInstance) {
    dbInstance = new KovasMissionCaptureDB()
  }
  return dbInstance
}

// ============================================
// Génération UUID (compatible Safari iOS 14+)
// ============================================

function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback (Safari < 15.4)
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

// ============================================
// Photos
// ============================================

export interface EnqueuePhotoInput {
  dossierId: string
  roomId: string | null
  roomName: string | null
  blob: Blob
  thumbnailBlob: Blob | null
  capturedAt: number
  /** Largeur du blob compressé. */
  width: number
  /** Hauteur du blob compressé. */
  height: number
  /** Taille bytes du blob compressé. */
  sizeBytes: number
  /** dHash 16 hex. */
  perceptualHash: string
  /** Floue ? (variance Laplacian) */
  isBlurry: boolean
  gpsLat?: number
  gpsLng?: number
  deviceInfo?: PhotoDeviceInfo
}

export async function enqueuePhoto(input: EnqueuePhotoInput): Promise<string> {
  const db = getMissionDb()
  const id = generateLocalId()
  const op: QueuedPhotoOperation = {
    id,
    kind: 'photo',
    dossierId: input.dossierId,
    roomId: input.roomId,
    roomName: input.roomName,
    blob: input.blob,
    thumbnailBlob: input.thumbnailBlob,
    capturedAt: input.capturedAt,
    width: input.width,
    height: input.height,
    sizeBytes: input.sizeBytes,
    perceptualHash: input.perceptualHash,
    isBlurry: input.isBlurry,
    gpsLat: input.gpsLat,
    gpsLng: input.gpsLng,
    deviceInfo: input.deviceInfo,
    syncStatus: 'pending_upload',
    attempts: 0,
    lastError: null,
    createdAt: Date.now(),
  }
  await db.photos.add(op)
  return id
}

export async function getPendingPhotos(dossierId: string): Promise<QueuedPhotoOperation[]> {
  const db = getMissionDb()
  return db.photos
    .where('dossierId')
    .equals(dossierId)
    .and((p) => p.syncStatus === 'pending_upload')
    .toArray()
}

export async function getAllPhotosForDossier(dossierId: string): Promise<QueuedPhotoOperation[]> {
  const db = getMissionDb()
  return db.photos.where('dossierId').equals(dossierId).sortBy('createdAt')
}

export async function markPhotoUploaded(localId: string, serverPhotoId: string): Promise<void> {
  const db = getMissionDb()
  await db.photos.update(localId, {
    syncStatus: 'uploaded',
    serverPhotoId,
  })
}

export async function markPhotoFailed(localId: string, error: string): Promise<void> {
  const db = getMissionDb()
  const photo = await db.photos.get(localId)
  if (!photo) return
  await db.photos.update(localId, {
    syncStatus: 'failed',
    attempts: photo.attempts + 1,
    lastError: error,
  })
}

export async function deletePhoto(localId: string): Promise<void> {
  const db = getMissionDb()
  await db.photos.delete(localId)
}

// ============================================
// Voice notes
// ============================================

export interface EnqueueVoiceNoteInput {
  dossierId: string
  roomId: string | null
  blob: Blob
  durationSeconds: number
  mimeType: string
  attachedLocalPhotoId: string | null
  /** Si la photo source est déjà uploadée serveur, on peut shortcut le INSERT. */
  attachedPhotoServerId?: string | null
}

export async function enqueueVoiceNote(input: EnqueueVoiceNoteInput): Promise<string> {
  const db = getMissionDb()
  const id = generateLocalId()
  const op: QueuedVoiceNoteOperation = {
    id,
    kind: 'voice',
    dossierId: input.dossierId,
    roomId: input.roomId,
    blob: input.blob,
    durationSeconds: input.durationSeconds,
    mimeType: input.mimeType,
    attachedLocalPhotoId: input.attachedLocalPhotoId,
    attachedPhotoServerId: input.attachedPhotoServerId ?? null,
    syncStatus: 'pending_upload',
    attempts: 0,
    lastError: null,
    createdAt: Date.now(),
    transcriptionStatus: 'pending',
  }
  await db.voiceNotes.add(op)
  return id
}

export async function getPendingVoiceNotes(dossierId: string): Promise<QueuedVoiceNoteOperation[]> {
  const db = getMissionDb()
  return db.voiceNotes
    .where('dossierId')
    .equals(dossierId)
    .and((v) => v.syncStatus === 'pending_upload')
    .toArray()
}

export async function markVoiceNoteUploaded(localId: string, serverVoiceId: string): Promise<void> {
  const db = getMissionDb()
  await db.voiceNotes.update(localId, {
    syncStatus: 'uploaded',
    serverVoiceId,
  })
}

export async function markVoiceNoteTranscribed(
  localId: string,
  transcription: string,
): Promise<void> {
  const db = getMissionDb()
  await db.voiceNotes.update(localId, {
    transcriptionStatus: 'transcribed',
    // on garde lastError = null si on avait précédemment échoué
    lastError: null,
  })
  // transcription n'est pas stockée localement (server side), mais on log via console
  // pour debug (utile dans Service Worker).
  console.info('[voice-notes] transcribed', localId, transcription.slice(0, 60))
}

export async function markVoiceNoteFailed(localId: string, error: string): Promise<void> {
  const db = getMissionDb()
  const v = await db.voiceNotes.get(localId)
  if (!v) return
  await db.voiceNotes.update(localId, {
    syncStatus: 'failed',
    attempts: v.attempts + 1,
    lastError: error,
  })
}

/**
 * Résout l'attachedPhotoServerId d'une voice note locale après upload de la photo.
 * Appelé par le sync manager dès qu'une photo passe en 'uploaded'.
 */
export async function resolveVoiceNotePhotoServerId(
  localPhotoId: string,
  serverPhotoId: string,
): Promise<void> {
  const db = getMissionDb()
  await db.voiceNotes
    .where('attachedLocalPhotoId')
    .equals(localPhotoId)
    .modify({ attachedPhotoServerId: serverPhotoId })
}

/**
 * Compte les voice notes (pending ou uploaded) attachées à une photo locale.
 * Utilisé pour les badges 🎤 sur les vignettes du carrousel.
 */
export async function countVoiceNotesForPhoto(localPhotoId: string): Promise<number> {
  const db = getMissionDb()
  return db.voiceNotes.where('attachedLocalPhotoId').equals(localPhotoId).count()
}

// ============================================
// Text notes
// ============================================

export interface EnqueueTextNoteInput {
  dossierId: string
  roomId: string | null
  text: string
  attachedLocalPhotoId: string | null
  attachedPhotoServerId?: string | null
}

export async function enqueueTextNote(input: EnqueueTextNoteInput): Promise<string> {
  const db = getMissionDb()
  const id = generateLocalId()
  const op: QueuedTextNoteOperation = {
    id,
    kind: 'text',
    dossierId: input.dossierId,
    roomId: input.roomId,
    text: input.text,
    attachedLocalPhotoId: input.attachedLocalPhotoId,
    attachedPhotoServerId: input.attachedPhotoServerId ?? null,
    syncStatus: 'pending_upload',
    attempts: 0,
    lastError: null,
    createdAt: Date.now(),
  }
  await db.textNotes.add(op)
  return id
}

export async function getPendingTextNotes(dossierId: string): Promise<QueuedTextNoteOperation[]> {
  const db = getMissionDb()
  return db.textNotes
    .where('dossierId')
    .equals(dossierId)
    .and((t) => t.syncStatus === 'pending_upload')
    .toArray()
}

export async function markTextNoteUploaded(localId: string, serverTextId: string): Promise<void> {
  const db = getMissionDb()
  await db.textNotes.update(localId, {
    syncStatus: 'uploaded',
    serverTextId,
  })
}

export async function markTextNoteFailed(localId: string, error: string): Promise<void> {
  const db = getMissionDb()
  const t = await db.textNotes.get(localId)
  if (!t) return
  await db.textNotes.update(localId, {
    syncStatus: 'failed',
    attempts: t.attempts + 1,
    lastError: error,
  })
}

/**
 * Résout l'attachedPhotoServerId d'une text note locale après upload de la photo.
 */
export async function resolveTextNotePhotoServerId(
  localPhotoId: string,
  serverPhotoId: string,
): Promise<void> {
  const db = getMissionDb()
  await db.textNotes
    .where('attachedLocalPhotoId')
    .equals(localPhotoId)
    .modify({ attachedPhotoServerId: serverPhotoId })
}

/**
 * Compte les text notes attachées à une photo locale (pour badge ✏️).
 */
export async function countTextNotesForPhoto(localPhotoId: string): Promise<number> {
  const db = getMissionDb()
  return db.textNotes.where('attachedLocalPhotoId').equals(localPhotoId).count()
}

// ============================================
// Mutations (catch-all pour ops non-photo/voice/text)
// ============================================

export interface EnqueueMutationInput {
  dossierId: string
  mutationKind: string
  payload: Record<string, unknown>
}

export async function enqueueMutation(input: EnqueueMutationInput): Promise<string> {
  const db = getMissionDb()
  const id = generateLocalId()
  const op: QueuedMutationOperation = {
    id,
    kind: 'mutation',
    dossierId: input.dossierId,
    mutationKind: input.mutationKind,
    payload: input.payload,
    syncStatus: 'pending_upload',
    attempts: 0,
    lastError: null,
    createdAt: Date.now(),
  }
  await db.mutations.add(op)
  return id
}

// ============================================
// Helpers généraux
// ============================================

/**
 * Compte les opérations en attente de sync pour un dossier
 * (utile pour le badge "X éléments à synchroniser").
 */
export async function countPending(dossierId: string): Promise<{
  photos: number
  voiceNotes: number
  textNotes: number
  mutations: number
  total: number
}> {
  const db = getMissionDb()
  const filter = (s: SyncOperationStatus) => s === 'pending_upload'
  const [photos, voiceNotes, textNotes, mutations] = await Promise.all([
    db.photos
      .where('dossierId')
      .equals(dossierId)
      .and((p) => filter(p.syncStatus))
      .count(),
    db.voiceNotes
      .where('dossierId')
      .equals(dossierId)
      .and((v) => filter(v.syncStatus))
      .count(),
    db.textNotes
      .where('dossierId')
      .equals(dossierId)
      .and((t) => filter(t.syncStatus))
      .count(),
    db.mutations
      .where('dossierId')
      .equals(dossierId)
      .and((m) => filter(m.syncStatus))
      .count(),
  ])
  return {
    photos,
    voiceNotes,
    textNotes,
    mutations,
    total: photos + voiceNotes + textNotes + mutations,
  }
}

/**
 * Purge toutes les opérations déjà synchronisées (statut 'uploaded')
 * plus vieilles que `maxAgeMs` — défaut 24h. Sécurité contre le ballonnement du blob storage.
 */
export async function purgeUploaded(maxAgeMs = 24 * 60 * 60 * 1000): Promise<number> {
  const db = getMissionDb()
  const threshold = Date.now() - maxAgeMs
  let purged = 0
  await db.transaction('rw', [db.photos, db.voiceNotes, db.textNotes, db.mutations], async () => {
    purged += await db.photos
      .where('createdAt')
      .below(threshold)
      .and((p) => p.syncStatus === 'uploaded')
      .delete()
    purged += await db.voiceNotes
      .where('createdAt')
      .below(threshold)
      .and((v) => v.syncStatus === 'uploaded')
      .delete()
    purged += await db.textNotes
      .where('createdAt')
      .below(threshold)
      .and((t) => t.syncStatus === 'uploaded')
      .delete()
    purged += await db.mutations
      .where('createdAt')
      .below(threshold)
      .and((m) => m.syncStatus === 'uploaded')
      .delete()
  })
  return purged
}
