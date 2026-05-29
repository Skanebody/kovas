'use client'

/**
 * KOVAS — Mode mission tchat : store offline Dexie pour notes texte/vocal (BUG 1 + 2).
 *
 * Réplique EXACTE du pattern `photos-offline-store.ts`, appliquée au flux
 * texte/vocal du mode Capture :
 *   - clef d'index = `mission_session_id` (cohérent avec photos)
 *   - statuts pending / uploading / synced / error + client_local_id idempotence
 *   - soft retry au retour `online` (resetErroredNotesToPending)
 *   - persistence post-sync 30j (soft delete) → cohérent avec les photos
 *
 * Deux variantes de note dans la MÊME table (champ `kind`) :
 *   - `text`  : note texte rapide (mode Capture, écrit OU transcription vocale
 *     déjà obtenue) → rejouée via POST /api/dossiers/[id]/notes (upsert).
 *   - `voice` : note vocale dont le BLOB AUDIO est conservé localement AVANT
 *     tout réseau (BUG 2). Au retour réseau, le manager uploade + transcrit le
 *     blob via /api/transcribe (qui persiste voice_notes idempotent).
 *
 * Lifecycle texte :
 *   1. sendMessage (mode Capture) → addTextNote()
 *   2. NotesSyncManager lit getPendingNotes() → POST /notes (upsert client_local_id)
 *   3. markNoteSynced(id, serverId) → 'synced'
 *
 * Lifecycle vocal :
 *   1. commitVoiceMessage (mode Capture) → addVoiceNote() AVANT tout réseau
 *   2. NotesSyncManager → POST /api/transcribe (upload blob + Whisper + voice_notes)
 *   3. markNoteSynced(id, voiceNoteId) → 'synced' (callback transcript pour la bulle)
 *
 * Authority : CLAUDE.md §3 features 1 (vocal) + 10 (offline complet) + brief BUG 1/2.
 */

import Dexie, { type Table } from 'dexie'

// ============================================
// Types
// ============================================

export type NoteSyncStatus = 'pending' | 'uploading' | 'synced' | 'error'

export type NoteKind = 'text' | 'voice'

export interface PendingNote {
  /** UUID local (clef idempotence côté serveur). */
  id: string
  dossier_id: string
  mission_session_id: string
  /** Slug pièce active sidebar (ou null si non-associée). */
  room_id: string | null
  kind: NoteKind
  /**
   * Texte de la note. Pour `text` = le contenu saisi/dicté. Pour `voice`, c'est
   * le transcript Web Speech de secours (fallback si la transcription Whisper
   * offline n'aboutit jamais) — peut être vide tant qu'on n'a que l'audio.
   */
  text: string
  /** Source d'origine : saisie écrite ou dictée vocale (audit / analytics). */
  source: 'text' | 'voice'
  /** Blob audio (UNIQUEMENT kind=voice) conservé AVANT réseau (BUG 2). */
  audio_blob?: Blob
  /** MIME réel du blob audio (audio/mp4 Safari, audio/webm Chrome). */
  audio_mime?: string
  /** Durée du blob audio en secondes (gating Whisper + UI mini-player). */
  audio_duration?: number
  sync_status: NoteSyncStatus
  upload_attempts: number
  last_error?: string
  /** ID serveur de la row (mission_text_notes.id ou voice_notes.id) post-sync. */
  server_note_id?: string
  /** Timestamp ISO côté client à la création. */
  created_at: string
  /** Timestamp ISO côté client au sync (ou absent si pas encore). */
  synced_at?: string
}

// ============================================
// Schéma DB Dexie
// ============================================

class KovasNotesDb extends Dexie {
  notes!: Table<PendingNote, string>

  constructor() {
    super('kovas-mission-notes')
    this.version(1).stores({
      // PK = id (UUID local). Indexes utiles pour les queries fréquentes.
      notes: 'id, dossier_id, mission_session_id, room_id, kind, sync_status, created_at',
    })
  }
}

let dbInstance: KovasNotesDb | null = null

/** Singleton — instancie uniquement côté client (window check). */
export function getNotesDb(): KovasNotesDb {
  if (typeof window === 'undefined') {
    throw new Error('getNotesDb() called server-side — IndexedDB is client-only')
  }
  if (!dbInstance) {
    dbInstance = new KovasNotesDb()
  }
  return dbInstance
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

export interface AddTextNoteInput {
  dossier_id: string
  mission_session_id: string
  room_id: string | null
  text: string
  source: 'text' | 'voice'
}

/**
 * Ajoute une note TEXTE en file d'attente locale + retourne son uuid local.
 * Le `source` distingue saisie écrite vs transcription vocale déjà obtenue.
 */
export async function addTextNote(input: AddTextNoteInput): Promise<string> {
  const db = getNotesDb()
  const id = generateLocalId()
  const note: PendingNote = {
    id,
    dossier_id: input.dossier_id,
    mission_session_id: input.mission_session_id,
    room_id: input.room_id,
    kind: 'text',
    text: input.text,
    source: input.source,
    sync_status: 'pending',
    upload_attempts: 0,
    created_at: nowIso(),
  }
  await db.notes.add(note)
  return id
}

export interface AddVoiceNoteInput {
  dossier_id: string
  mission_session_id: string
  room_id: string | null
  audio_blob: Blob
  audio_mime: string
  audio_duration: number
  /** Transcript Web Speech de secours (peut être vide). */
  fallback_text: string
}

/**
 * Ajoute une note VOCALE (avec son blob audio) AVANT tout appel réseau (BUG 2).
 * Le blob est ainsi durable : si la transcription échoue offline, il sera
 * réessayé au retour réseau au lieu d'être perdu avec l'objectURL révoqué.
 */
export async function addVoiceNote(input: AddVoiceNoteInput): Promise<string> {
  const db = getNotesDb()
  const id = generateLocalId()
  const note: PendingNote = {
    id,
    dossier_id: input.dossier_id,
    mission_session_id: input.mission_session_id,
    room_id: input.room_id,
    kind: 'voice',
    text: input.fallback_text,
    source: 'voice',
    audio_blob: input.audio_blob,
    audio_mime: input.audio_mime,
    audio_duration: input.audio_duration,
    sync_status: 'pending',
    upload_attempts: 0,
    created_at: nowIso(),
  }
  await db.notes.add(note)
  return id
}

/** Toutes les notes en attente (pending OR error retry) pour une session. */
export async function getPendingNotes(missionSessionId: string): Promise<PendingNote[]> {
  const db = getNotesDb()
  return db.notes
    .where('mission_session_id')
    .equals(missionSessionId)
    .and((n) => n.sync_status === 'pending' || n.sync_status === 'error')
    .sortBy('created_at')
}

/**
 * Liste des mission_session_id ayant au moins une note à synchroniser
 * (pending OU error), toutes sessions confondues — pour le drain global
 * (BUG 1/2) au retour réseau / montage app, même écran mission fermé.
 */
export async function getSessionsWithPendingNotes(): Promise<string[]> {
  const db = getNotesDb()
  const ids = new Set<string>()
  await db.notes
    .where('sync_status')
    .anyOf('pending', 'error')
    .each((n) => {
      ids.add(n.mission_session_id)
    })
  return [...ids]
}

/**
 * Remet en `pending` toutes les notes en `error` (et réinitialise le compteur
 * de tentatives) pour redonner une chance au sync au retour réseau.
 * Calqué sur resetErroredPhotosToPending — pas d'exclusion à vie après N échecs.
 *
 * @param missionSessionId — limite le reset à une session, ou toutes si null.
 * @returns nombre de notes réarmées.
 */
export async function resetErroredNotesToPending(
  missionSessionId: string | null = null,
): Promise<number> {
  const db = getNotesDb()
  const collection =
    missionSessionId === null
      ? db.notes.where('sync_status').equals('error')
      : db.notes
          .where('mission_session_id')
          .equals(missionSessionId)
          .and((n) => n.sync_status === 'error')
  return collection.modify((n) => {
    n.sync_status = 'pending'
    n.upload_attempts = 0
  })
}

/** Bascule statut → uploading (avant tentative). */
export async function markNoteUploading(id: string): Promise<void> {
  const db = getNotesDb()
  await db.notes.update(id, { sync_status: 'uploading' })
}

/**
 * Remet une note `uploading` en `pending` SANS pénalité (cas : on est repassé
 * offline en plein envoi). Ainsi la note reste éligible au prochain cycle au
 * lieu de rester coincée en `uploading`.
 */
export async function revertNoteToPending(id: string): Promise<void> {
  const db = getNotesDb()
  await db.notes.update(id, { sync_status: 'pending' })
}

/**
 * Bascule statut → synced avec l'id serveur. Pour une note vocale, on libère le
 * blob audio (devenu inutile une fois la voice_note persistée côté serveur).
 */
export async function markNoteSynced(id: string, serverNoteId: string): Promise<void> {
  const db = getNotesDb()
  await db.notes.update(id, {
    sync_status: 'synced',
    server_note_id: serverNoteId,
    synced_at: nowIso(),
    // Libère le blob audio : la source de vérité est maintenant Supabase.
    audio_blob: undefined,
  })
}

/** Marque une note en erreur + incrémente compteur tentatives. */
export async function markNoteError(id: string, errorMessage: string): Promise<void> {
  const db = getNotesDb()
  const note = await db.notes.get(id)
  if (!note) return
  await db.notes.update(id, {
    sync_status: 'error',
    upload_attempts: note.upload_attempts + 1,
    last_error: errorMessage,
  })
}

/** Met à jour le transcript d'une note vocale post-Whisper (avant sync final). */
export async function updateVoiceNoteTranscript(id: string, text: string): Promise<void> {
  const db = getNotesDb()
  await db.notes.update(id, { text })
}

/** Statut de sync live d'une seule note (par id local) — pour badge bulle. */
export async function getNoteSyncStatus(id: string): Promise<NoteSyncStatus | undefined> {
  const db = getNotesDb()
  const n = await db.notes.get(id)
  return n?.sync_status
}

/**
 * Purge les notes synced de plus de `maxAgeMs` (défaut 30j). À appeler au mount
 * de l'interface tchat pour limiter le ballonnement IndexedDB (cohérent photos).
 */
export async function purgeOldNotes(maxAgeMs: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
  const db = getNotesDb()
  const threshold = new Date(Date.now() - maxAgeMs).toISOString()
  return db.notes
    .where('created_at')
    .below(threshold)
    .and((n) => n.sync_status === 'synced')
    .delete()
}

// ============================================
// Snapshot (exposition UI éventuelle — parité photos)
// ============================================

export interface NotesSyncSnapshot {
  pending: number
  uploading: number
  synced: number
  errors: number
  total: number
}

export async function getNotesSyncSnapshot(missionSessionId: string): Promise<NotesSyncSnapshot> {
  const db = getNotesDb()
  const all = await db.notes.where('mission_session_id').equals(missionSessionId).toArray()
  let pending = 0
  let uploading = 0
  let synced = 0
  let errors = 0
  for (const n of all) {
    if (n.sync_status === 'pending') pending++
    else if (n.sync_status === 'uploading') uploading++
    else if (n.sync_status === 'synced') synced++
    else if (n.sync_status === 'error') errors++
  }
  return { pending, uploading, synced, errors, total: all.length }
}
