'use client'

/**
 * KOVAS — Mode mission tchat : sync manager notes texte/vocal (BUG 1 + 2).
 *
 * Réplique EXACTE du `photos-sync-manager.ts`, appliquée aux notes :
 *   - Écoute window.online + intervalle 15s
 *   - Lit getPendingNotes() depuis Dexie
 *   - Rejoue chaque note (text → POST /notes ; voice → POST /api/transcribe)
 *   - markNoteSynced() / markNoteError() avec backoff exponentiel plafonné
 *   - Idempotence via client_local_id (upsert serveur — pas de doublon au rejeu)
 *
 * Robustesse réseau instable (audit terrain — sous-sol / vide-sanitaire),
 * mêmes invariants que le manager photos :
 *   - upsert idempotent (client_local_id) — un rejeu ne crée pas de doublon.
 *   - pas d'exclusion définitive — au retour `online`, on réarme les notes en
 *     `error` (reset compteur) et on relance un cycle.
 *   - on ne consomme une tentative QUE sur échec réseau réel alors que
 *     navigator.onLine === true. Hors-ligne = on ne tente pas, pas de pénalité.
 *
 * Spécificité vocal (BUG 2) : la note vocale embarque son blob audio. Au sync,
 * on uploade+transcrit via /api/transcribe. La transcription obtenue est
 * remontée au composant via le callback `onVoiceTranscribed` pour mettre à jour
 * la bulle (qui affichait "Transcription en attente — hors connexion").
 *
 * Authority : CLAUDE.md §3 features 1 + 10 + brief BUG 1/2.
 */

import {
  type NoteSyncStatus,
  type PendingNote,
  getPendingNotes,
  getSessionsWithPendingNotes,
  markNoteError,
  markNoteSynced,
  markNoteUploading,
  resetErroredNotesToPending,
  revertNoteToPending,
  updateVoiceNoteTranscript,
} from './mission-notes-offline-store'

const POLL_INTERVAL_MS = 15_000
/**
 * (PERF-3) Backoff idle — parité photos-sync-manager : on ralentit le polling
 * (15s → 90s) après `IDLE_CYCLES_THRESHOLD` cycles vides consécutifs. Le tick
 * ré-accélère dès `kick`, `online`, ou un cycle non vide.
 */
const POLL_INTERVAL_IDLE_MS = 90_000
const IDLE_CYCLES_THRESHOLD = 3
const BACKOFF_BASE_MS = 2_000
const BACKOFF_MAX_MS = 5 * 60_000

interface NotesSyncContext {
  dossierId: string
  missionSessionId: string
}

/**
 * Callback de transcription d'une note vocale offline enfin transcrite.
 * Permet au composant de mettre à jour la bulle correspondante (par
 * client_local_id) avec le texte Whisper + la signed URL audio.
 */
export interface VoiceTranscribedPayload {
  noteLocalId: string
  transcript: string
  audioSignedUrl: string | null
}
export type OnVoiceTranscribedFn = (payload: VoiceTranscribedPayload) => void

export class NotesSyncManager {
  private running = false
  private globalRunning = false
  /** (PERF-3) Timeout auto-replanifié à délai adaptatif (remplace setInterval). */
  private pollTimeoutId: ReturnType<typeof setTimeout> | null = null
  /** (PERF-3) Compteur de cycles vides consécutifs (rythme idle au-delà du seuil). */
  private idleCycles = 0
  private context: NotesSyncContext | null = null
  private onlineListener: (() => void) | null = null
  private inflightIds = new Set<string>()
  private nextAttemptAt = new Map<string, number>()
  /** Listeners de transcription vocale (composant mission monté). */
  private voiceListeners = new Set<OnVoiceTranscribedFn>()

  start(context: NotesSyncContext): void {
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

    this.idleCycles = 0
    void this.syncAll()
    this.scheduleNextPoll()
  }

  /** (PERF-3) Replanifie le prochain cycle au délai adaptatif (parité photos). */
  private scheduleNextPoll(): void {
    if (typeof window === 'undefined') return
    if (this.pollTimeoutId !== null) clearTimeout(this.pollTimeoutId)
    const delay =
      this.idleCycles >= IDLE_CYCLES_THRESHOLD ? POLL_INTERVAL_IDLE_MS : POLL_INTERVAL_MS
    this.pollTimeoutId = setTimeout(() => {
      if (navigator.onLine) void this.syncAll()
      else this.scheduleNextPoll()
    }, delay)
  }

  private async handleOnline(): Promise<void> {
    if (!this.context) return
    this.idleCycles = 0
    try {
      await resetErroredNotesToPending(this.context.missionSessionId)
      this.nextAttemptAt.clear()
    } catch {
      // best-effort — le polling rattrapera
    }
    await this.syncAll()
  }

  stop(): void {
    if (typeof window === 'undefined') return
    if (this.pollTimeoutId !== null) {
      clearTimeout(this.pollTimeoutId)
      this.pollTimeoutId = null
    }
    this.idleCycles = 0
    if (this.onlineListener) {
      window.removeEventListener('online', this.onlineListener)
      this.onlineListener = null
    }
    this.context = null
    this.inflightIds.clear()
    this.nextAttemptAt.clear()
  }

  /** S'abonne aux transcriptions vocales offline (retourne désabonnement). */
  onVoiceTranscribed(fn: OnVoiceTranscribedFn): () => void {
    this.voiceListeners.add(fn)
    return () => {
      this.voiceListeners.delete(fn)
    }
  }

  private notifyVoiceTranscribed(payload: VoiceTranscribedPayload): void {
    for (const fn of this.voiceListeners) fn(payload)
  }

  /** Force un sync immédiat (depuis composant après ajout de note). */
  async kick(): Promise<void> {
    // (PERF-3) Un ajout explicite ré-accélère le polling (sort du rythme idle).
    this.idleCycles = 0
    await this.syncAll()
    if (this.context) this.scheduleNextPoll()
  }

  async syncAll(): Promise<void> {
    if (this.running) return
    if (typeof window === 'undefined') return
    if (!navigator.onLine) {
      // (PERF-3) Replanifie même hors-ligne pour ne pas geler le polling.
      if (this.context) this.scheduleNextPoll()
      return
    }
    if (!this.context) return

    this.running = true
    try {
      const pending = await getPendingNotes(this.context.missionSessionId)
      // (PERF-3) File vide → cycle idle, court-circuit (aucun effet de bord ici).
      if (pending.length === 0) {
        this.idleCycles += 1
        return
      }
      const eligibles = this.filterEligible(pending)
      // (PERF-3) Il reste des notes → actif, reset idle.
      this.idleCycles = 0
      // Séquentiel (volume faible — notes texte/vocal ponctuelles) pour ne pas
      // saturer la bande passante terrain (souvent juste retrouvée).
      for (const note of eligibles) {
        await this.syncOne(note)
      }
    } finally {
      this.running = false
      if (this.context) this.scheduleNextPoll()
    }
  }

  /**
   * Sync GLOBAL — draine toutes les sessions ayant des notes en attente, même
   * si l'écran mission n'est pas monté. Appelé par GlobalMissionSync (layout).
   */
  async syncAllSessions(): Promise<void> {
    if (typeof window === 'undefined') return
    if (!navigator.onLine) return
    if (this.globalRunning) return

    this.globalRunning = true
    try {
      const sessionIds = await getSessionsWithPendingNotes()
      for (const sessionId of sessionIds) {
        const pending = await getPendingNotes(sessionId)
        const eligibles = this.filterEligible(pending)
        for (const note of eligibles) {
          await this.syncOne(note)
        }
      }
    } finally {
      this.globalRunning = false
    }
  }

  /** Réarme global + sync de toutes les sessions au retour réseau. */
  async resetAndSyncAllSessions(): Promise<void> {
    if (typeof window === 'undefined') return
    try {
      await resetErroredNotesToPending(null)
      this.nextAttemptAt.clear()
    } catch {
      // best-effort
    }
    await this.syncAllSessions()
  }

  /** Filtre inflight + cooldown de backoff (pas d'exclusion à vie). */
  private filterEligible(pending: PendingNote[]): PendingNote[] {
    return pending.filter((n) => {
      if (this.inflightIds.has(n.id)) return false
      const cooldown = this.nextAttemptAt.get(n.id) ?? 0
      return Date.now() >= cooldown
    })
  }

  private async syncOne(note: PendingNote): Promise<void> {
    if (this.inflightIds.has(note.id)) return
    this.inflightIds.add(note.id)
    try {
      await markNoteUploading(note.id)
      if (note.kind === 'voice') {
        await this.syncVoiceNote(note)
      } else {
        await this.syncTextNote(note)
      }
      this.nextAttemptAt.delete(note.id)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown error'
      // On ne consomme une tentative QUE sur échec réseau réel alors qu'on est
      // online (parité photos-sync-manager). Repassé offline pendant l'envoi →
      // pas de pénalité, cooldown court. On remet la note en `pending` (le
      // markNoteUploading l'avait sortie des éligibles) pour qu'elle reste
      // reprise au prochain cycle / retour réseau.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        this.nextAttemptAt.set(note.id, Date.now() + BACKOFF_BASE_MS)
        await revertNoteToPending(note.id).catch(() => undefined)
      } else {
        await markNoteError(note.id, msg)
        const nextAttempt = note.upload_attempts + 1
        const delayMs = Math.min(BACKOFF_BASE_MS * 4 ** (nextAttempt - 1), BACKOFF_MAX_MS)
        this.nextAttemptAt.set(note.id, Date.now() + delayMs)
      }
    } finally {
      this.inflightIds.delete(note.id)
    }
  }

  /** Note texte → POST /api/dossiers/[id]/notes (upsert idempotent). */
  private async syncTextNote(note: PendingNote): Promise<void> {
    const res = await fetch(`/api/dossiers/${note.dossier_id}/notes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sessionId: note.mission_session_id,
        text: note.text,
        roomId: note.room_id,
        source: note.source,
        clientLocalId: note.id,
      }),
    })
    if (!res.ok) throw new Error(`notes HTTP ${res.status}`)
    const data = (await res.json()) as { ok?: boolean; textNoteId?: string; soft_error?: string }
    if (!data.ok || !data.textNoteId) {
      // soft_error (RLS / table) → on garde la note en retry (pas de perte).
      throw new Error(`notes soft_error ${data.soft_error ?? 'no id'}`)
    }
    await markNoteSynced(note.id, data.textNoteId)
  }

  /**
   * Note vocale → POST /api/transcribe (upload blob + Whisper + voice_notes
   * idempotent). La transcription est remontée au composant via callback.
   */
  private async syncVoiceNote(note: PendingNote): Promise<void> {
    if (!note.audio_blob) {
      // Blob déjà libéré (note déjà synced en réalité) ou perdu — on synchronise
      // le texte de secours via la route notes pour ne rien perdre.
      if (note.text.trim().length > 0) {
        await this.syncTextNote({ ...note, kind: 'text' })
        return
      }
      throw new Error('voice note without audio blob')
    }

    const mime = note.audio_mime || note.audio_blob.type || 'audio/webm'
    const ext = mime.includes('mp4') || mime.includes('mpeg') ? 'mp4' : 'webm'
    const form = new FormData()
    form.append('audio', new File([note.audio_blob], `voice.${ext}`, { type: mime }))
    form.append('dossierId', note.dossier_id)
    form.append('sessionId', note.mission_session_id)
    form.append('clientLocalId', note.id)

    const res = await fetch('/api/transcribe', { method: 'POST', body: form })
    if (!res.ok) throw new Error(`transcribe HTTP ${res.status}`)
    const data = (await res.json()) as {
      transcript?: string
      markedText?: string
      audioSignedUrl?: string | null
      voiceNoteId?: string | null
    }
    const transcript = (data.markedText || data.transcript || '').trim()

    // Met à jour le transcript local (au cas où le serveur ne renvoie pas d'id).
    if (transcript) await updateVoiceNoteTranscript(note.id, transcript)

    // Remonte au composant pour rafraîchir la bulle (par client_local_id).
    this.notifyVoiceTranscribed({
      noteLocalId: note.id,
      transcript: transcript || note.text,
      audioSignedUrl: data.audioSignedUrl ?? null,
    })

    if (!data.voiceNoteId) {
      // L'upload Storage ou l'INSERT a échoué côté serveur → garde en retry.
      throw new Error('transcribe returned no voiceNoteId')
    }
    await markNoteSynced(note.id, data.voiceNoteId)
  }
}

export const notesSyncManager = new NotesSyncManager()

/** Re-export du type statut pour les hooks UI (parité photos). */
export type { NoteSyncStatus }
