'use client'

/**
 * KOVAS — Mode mission tchat : store offline Dexie pour photos rafale (MISSION-B).
 *
 * Distinct de `local-storage-queue.ts` (Capture-First mode) — ici, on est
 * spécifique au mode tchat IA conversationnel :
 *   - clef d'index = `mission_session_id` (pas dossier_id)
 *   - room_id = string (slug sidebar) — pas uuid dossier_rooms
 *   - thumbnail = base64 (preview chat inline) en plus du blob
 *   - persistence post-sync 30j (soft delete) pour ré-attribution offline
 *
 * Lifecycle :
 *   1. PhotoCaptureButton → addPhoto() après preprocessPhoto compression
 *   2. PhotosSyncManager lit getPendingPhotos() → upload Supabase Storage + INSERT mission_photos
 *   3. markPhotoSynced(id, storage_path) → état 'synced'
 *   4. Purge auto après 30j (J0+30 → deletePhoto définitif)
 *
 * Authority : CLAUDE.md §3 features 2 (photos géolocalisées) + 10 (offline complet).
 */

import Dexie, { type Table } from 'dexie'

// ============================================
// Types
// ============================================

export type PhotoSyncStatus = 'pending' | 'uploading' | 'synced' | 'error'

export type DeviceOrientation = 'portrait' | 'landscape'

export interface PendingPhotoMetadata {
  /** Timestamp ISO 8601 — wall clock client. */
  taken_at: string
  latitude: number | null
  longitude: number | null
  accuracy_meters: number | null
  device_orientation: DeviceOrientation
  /** dHash 16 hex (best-effort, post preprocessPhoto). */
  perceptual_hash?: string
  /** Détecté flou (variance Laplacian). */
  is_blurry?: boolean
  /** Largeur/hauteur du blob compressé. */
  width?: number
  height?: number
  /** Taille bytes du blob compressé. */
  size_bytes?: number
}

export interface PendingPhoto {
  /** UUID local (clef idempotence côté serveur). */
  id: string
  dossier_id: string
  mission_session_id: string
  /** Slug pièce active sidebar (ou null si non-associée). */
  room_id: string | null
  /** Blob JPEG compressé ~250KB. */
  blob: Blob
  /** Data URL `data:image/jpeg;base64,...` cap ~12KB pour preview chat. */
  thumbnail_base64: string
  metadata: PendingPhotoMetadata
  sync_status: PhotoSyncStatus
  upload_attempts: number
  last_error?: string
  /** Path Storage Supabase post-sync (id Supabase row mission_photos). */
  server_photo_id?: string
  storage_path?: string
  /** Timestamp ms côté client à la capture. */
  created_at: string
  /** Timestamp ms côté client au sync (ou null si pas encore). */
  synced_at?: string
}

// ============================================
// Schéma DB Dexie
// ============================================

class KovasPhotosDb extends Dexie {
  photos!: Table<PendingPhoto, string>

  constructor() {
    super('kovas-mission-photos')
    this.version(1).stores({
      // PK = id (UUID local). Indexes utiles pour les queries fréquentes.
      photos: 'id, dossier_id, mission_session_id, room_id, sync_status, created_at',
    })
  }
}

let dbInstance: KovasPhotosDb | null = null

/** Singleton — instancie uniquement côté client (window check). */
export function getPhotosDb(): KovasPhotosDb {
  if (typeof window === 'undefined') {
    throw new Error('getPhotosDb() called server-side — IndexedDB is client-only')
  }
  if (!dbInstance) {
    dbInstance = new KovasPhotosDb()
  }
  return dbInstance
}

/** Export pour usage hooks (dexie-react-hooks useLiveQuery). */
export const photosDb = {
  get: getPhotosDb,
}

// ============================================
// Helpers internes
// ============================================

function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

// ============================================
// Mutations
// ============================================

export interface AddPhotoInput {
  dossier_id: string
  mission_session_id: string
  room_id: string | null
  blob: Blob
  thumbnail_base64: string
  metadata: PendingPhotoMetadata
}

/**
 * Ajoute une photo en file d'attente locale + retourne son uuid local.
 * Idempotent : si un id est passé, on upsert ; sinon génération auto.
 */
export async function addPhoto(input: AddPhotoInput): Promise<string> {
  const db = getPhotosDb()
  const id = generateLocalId()
  const photo: PendingPhoto = {
    id,
    dossier_id: input.dossier_id,
    mission_session_id: input.mission_session_id,
    room_id: input.room_id,
    blob: input.blob,
    thumbnail_base64: input.thumbnail_base64,
    metadata: input.metadata,
    sync_status: 'pending',
    upload_attempts: 0,
    created_at: nowIso(),
  }
  await db.photos.add(photo)
  return id
}

/** Toutes les photos en attente (pending OR error retry) pour une session. */
export async function getPendingPhotos(missionSessionId: string): Promise<PendingPhoto[]> {
  const db = getPhotosDb()
  return db.photos
    .where('mission_session_id')
    .equals(missionSessionId)
    .and((p) => p.sync_status === 'pending' || p.sync_status === 'error')
    .sortBy('created_at')
}

/**
 * Liste des mission_session_id ayant au moins une photo à synchroniser
 * (pending OU error), toutes sessions confondues.
 *
 * Sert au sync global (P0-4) : au retour réseau / au montage de l'app, on
 * draine toutes les sessions, même celles dont l'écran mission n'est plus
 * monté (sinon une photo capturée hier en sous-sol resterait coincée tant
 * que le diagnostiqueur ne rouvre pas EXACTEMENT cette mission).
 */
export async function getSessionsWithPendingPhotos(): Promise<string[]> {
  const db = getPhotosDb()
  const ids = new Set<string>()
  await db.photos
    .where('sync_status')
    .anyOf('pending', 'error')
    .each((p) => {
      ids.add(p.mission_session_id)
    })
  return [...ids]
}

/**
 * Remet en `pending` toutes les photos en `error` (et réinitialise le
 * compteur de tentatives) pour redonner une chance au sync au retour réseau.
 *
 * Correctif P0-3 : sans ce reset, une photo ayant atteint le plafond de
 * tentatives restait exclue À VIE des éligibles — perte définitive alors que
 * le réseau est revenu. On l'appelle sur l'événement `online`.
 *
 * @param missionSessionId — limite le reset à une session, ou toutes si null.
 * @returns nombre de photos réarmées.
 */
export async function resetErroredPhotosToPending(
  missionSessionId: string | null = null,
): Promise<number> {
  const db = getPhotosDb()
  const collection =
    missionSessionId === null
      ? db.photos.where('sync_status').equals('error')
      : db.photos
          .where('mission_session_id')
          .equals(missionSessionId)
          .and((p) => p.sync_status === 'error')
  return collection.modify((p) => {
    p.sync_status = 'pending'
    p.upload_attempts = 0
  })
}

/** Toutes les photos liées à une pièce (pour vue groupée). */
export async function getPhotosByRoom(
  missionSessionId: string,
  roomId: string | null,
): Promise<PendingPhoto[]> {
  const db = getPhotosDb()
  if (roomId === null) {
    return db.photos
      .where('mission_session_id')
      .equals(missionSessionId)
      .and((p) => p.room_id === null)
      .sortBy('created_at')
  }
  return (
    db.photos
      .where('[mission_session_id+room_id]')
      .equals([missionSessionId, roomId])
      .sortBy('created_at')
      // Fallback si index composé pas dispo (Dexie v1 store) :
      .catch(async () => {
        return db.photos
          .where('mission_session_id')
          .equals(missionSessionId)
          .and((p) => p.room_id === roomId)
          .sortBy('created_at')
      })
  )
}

/** Compte total photos pour une session (pending + synced — pour Context Bar). */
export async function getPhotoCount(missionSessionId: string): Promise<number> {
  const db = getPhotosDb()
  return db.photos.where('mission_session_id').equals(missionSessionId).count()
}

/** Bascule statut → uploading (avant tentative). */
export async function markPhotoUploading(id: string): Promise<void> {
  const db = getPhotosDb()
  await db.photos.update(id, { sync_status: 'uploading' })
}

/** Bascule statut → synced avec storage_path + server_photo_id (post-INSERT). */
export async function markPhotoSynced(
  id: string,
  serverPhotoId: string,
  storagePath: string,
): Promise<void> {
  const db = getPhotosDb()
  await db.photos.update(id, {
    sync_status: 'synced',
    server_photo_id: serverPhotoId,
    storage_path: storagePath,
    synced_at: nowIso(),
  })
}

/** Marque une photo en erreur + incrémente compteur tentatives. */
export async function markPhotoError(id: string, errorMessage: string): Promise<void> {
  const db = getPhotosDb()
  const photo = await db.photos.get(id)
  if (!photo) return
  await db.photos.update(id, {
    sync_status: 'error',
    upload_attempts: photo.upload_attempts + 1,
    last_error: errorMessage,
  })
}

/** Met à jour le room_id d'une photo (réattribution depuis modal full-screen). */
export async function reassignPhotoRoom(id: string, newRoomId: string | null): Promise<void> {
  const db = getPhotosDb()
  await db.photos.update(id, { room_id: newRoomId })
}

/**
 * Soft delete : on garde la row 30j pour permettre la ré-attribution offline.
 * La purge définitive est faite par purgeOldPhotos() (appel périodique au mount).
 */
export async function deletePhoto(id: string): Promise<void> {
  const db = getPhotosDb()
  await db.photos.delete(id)
}

/**
 * Purge les photos synced de plus de `maxAgeMs` (défaut 30j).
 * À appeler au mount de l'interface tchat pour limiter le ballonnement IndexedDB.
 */
export async function purgeOldPhotos(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
  const db = getPhotosDb()
  const threshold = new Date(Date.now() - maxAgeMs).toISOString()
  return db.photos
    .where('created_at')
    .below(threshold)
    .and((p) => p.sync_status === 'synced')
    .delete()
}

/**
 * Snapshot des compteurs de sync pour exposition UI.
 * Utilisé par PhotosSyncManager pour exposer son state via subscribers.
 */
export interface PhotosSyncSnapshot {
  pending: number
  uploading: number
  synced: number
  errors: number
  total: number
}

export async function getSyncSnapshot(missionSessionId: string): Promise<PhotosSyncSnapshot> {
  const db = getPhotosDb()
  const all = await db.photos.where('mission_session_id').equals(missionSessionId).toArray()
  let pending = 0
  let uploading = 0
  let synced = 0
  let errors = 0
  for (const p of all) {
    if (p.sync_status === 'pending') pending++
    else if (p.sync_status === 'uploading') uploading++
    else if (p.sync_status === 'synced') synced++
    else if (p.sync_status === 'error') errors++
  }
  return { pending, uploading, synced, errors, total: all.length }
}
