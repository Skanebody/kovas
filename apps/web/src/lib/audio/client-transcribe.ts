/**
 * KOVAS — Helper client de transcription audio (Lot B93, refonte acqui-target 2026-05).
 *
 * Source : `docs/refonte-2026-05/AI_ECONOMICS.md` (technique 6 — "Whisper hybride
 * local WASM + API") + JSDoc B58 `transcription-router.ts` §IMPORTANT.
 *
 * Wrap les 3 chemins de transcription audio derrière une seule fonction :
 *   1. `local_wasm` — on-device via `useLocalWhisper` (coût 0 EUR).
 *      Scaffold uniquement pour l'instant — throw fallback API silencieux.
 *   2. `api_whisper_mini` — POST `/api/transcribe`, modèle `gpt-4o-mini-transcribe`.
 *   3. `api_whisper_standard` — POST `/api/transcribe`, modèle `whisper-1`.
 *
 * Le routing repose sur le router pure-fn B58 `decideTranscriptionEngine` :
 *   - audio court (< 180s) + silencieux (noise < 0.4) + WASM dispo → local
 *   - audio long (> 600s) → standard
 *   - sinon → mini (défaut éco, 50% moins cher que standard)
 *
 * En cas d'échec local (lib WASM non chargée, erreur d'inference, hardware
 * incompat), on bascule SILENCIEUSEMENT sur l'API avec un header
 * `X-Transcription-Engine: local_wasm_attempted_failed` — le serveur compte
 * les retombées pour mesurer le ratio local vs API et prioriser le branchement
 * réel de la lib WASM.
 *
 * Cible : -15% du coût transcription une fois la lib WASM installée et 30-50%
 * des audios routés en local. Aujourd'hui (scaffold), 100% des audios passent
 * encore par l'API mais l'observabilité capture le "would-be local" pour
 * mesurer le potentiel d'économie.
 *
 * Authority : CLAUDE.md §3 feature #1 (saisie vocale terrain hybride FR).
 */

import {
  type AudioMetadata,
  type TranscriptionEngine,
  decideTranscriptionEngine,
} from '@/lib/audio/transcription-router'
import { type LocalWhisperResult, detectWasmSupport } from '@/lib/audio/use-local-whisper'

/* ─── Types publics ─────────────────────────────────────────────────────── */

/**
 * Options de transcription côté client.
 *
 * `localWhisper` est un objet optionnel injecté par le composant qui détient
 * le hook `useLocalWhisper()` — c'est de l'inversion de dépendance pour
 * permettre au helper d'appeler `transcribe()` sans monter lui-même un hook
 * (impossible hors composant React).
 */
export interface ClientTranscribeOptions {
  /** ID du dossier — passé à l'API pour scoping RLS + Whisper prompt. */
  dossierId: string
  /** ID de session mission optionnel (replay segment scoping). */
  sessionId?: string | null
  /** Métadonnées audio pour le router B58. */
  meta: AudioMetadata
  /**
   * Handle vers le moteur local (issu de `useLocalWhisper()` côté composant).
   * Si absent, on saute directement le local pour ne pas bloquer.
   */
  localWhisper?: {
    isReady: boolean
    isSupported: boolean
    transcribe: (audioBlob: Blob) => Promise<LocalWhisperResult>
  }
  /**
   * AbortSignal pour le fetch API (timeout côté caller). Le local n'est pas
   * cancellable aujourd'hui (`@xenova/transformers` ne supporte pas AbortController).
   */
  signal?: AbortSignal
}

/**
 * Shape normalisé du résultat — identique pour local et API (sauf champs
 * spécifiques API comme `audioSignedUrl`, `voiceNoteId` qui sont optionnels).
 */
export interface ClientTranscribeResult {
  /** Transcription finale (markedText pour API si dispo, sinon text brut). */
  transcript: string
  /** Engine effectif utilisé (peut différer du `decision.engine` initial). */
  engine: TranscriptionEngine
  /** Identifiant du modèle utilisé (gpt-4o-mini-transcribe | whisper-1 | local). */
  model: string
  /** Coût EUR estimé de la transcription (0 si local). */
  costEur: number
  /** Latence end-to-end en ms (mesurée côté client). */
  latencyMs: number
  /** Champs additionnels propagés depuis `/api/transcribe` si engine = API. */
  audioSignedUrl?: string | null
  audioStoragePath?: string | null
  voiceNoteId?: string | null
  segments?: unknown[]
  language?: string
  durationSeconds?: number
}

/* ─── Constantes internes ───────────────────────────────────────────────── */

const TRANSCRIBE_API_PATH = '/api/transcribe'
const HEADER_ENGINE_HINT = 'X-Transcription-Engine'

/** Marqueur signalant au serveur qu'on a essayé local et que c'est tombé. */
const ENGINE_HINT_LOCAL_FAILED = 'local_wasm_attempted_failed'

/* ─── Fonction principale ──────────────────────────────────────────────── */

/**
 * Transcrit un audio en passant par le meilleur moteur disponible.
 *
 * Flux décisionnel :
 *   1. Calcule `decision` via le router pure-fn B58 (audio short+quiet → local_wasm).
 *   2. Si décision = `local_wasm` ET `localWhisper.isReady` :
 *      a. Tente la transcription on-device.
 *      b. Si OK → renvoie résultat normalisé `engine: 'local_wasm'`.
 *      c. Si throw → bascule API avec header `X-Transcription-Engine: local_wasm_attempted_failed`.
 *   3. Sinon, fetch direct `/api/transcribe` (le serveur fait son propre routing
 *      mini vs standard via le même router B58).
 *
 * @throws Erreur explicite si TOUS les chemins échouent (API HTTP 5xx + pas
 *         de fallback possible). Le caller affiche un toast utilisateur dans
 *         ce cas.
 */
export async function transcribeAudioClient(
  audioBlob: Blob,
  options: ClientTranscribeOptions,
): Promise<ClientTranscribeResult> {
  const t0 = Date.now()

  // ── Étape 1 : décision routing via le router pure-fn B58 ───────────────
  // localAvailable reflète l'état réel du hook côté composant : pas dispo
  // → router fallback API direct, pas dispo + scaffold → on tentera quand
  // même de basculer si la décision était local_wasm pour mesurer le potentiel.
  const localAvailable = Boolean(options.localWhisper?.isSupported && options.localWhisper?.isReady)
  const decision = decideTranscriptionEngine(options.meta, { localAvailable })

  // ── Étape 2 : tentative locale si éligible ─────────────────────────────
  if (decision.engine === 'local_wasm' && options.localWhisper?.isReady) {
    try {
      const local = await options.localWhisper.transcribe(audioBlob)
      return {
        transcript: local.text,
        engine: 'local_wasm',
        model: 'whisper-tiny-wasm',
        costEur: 0,
        latencyMs: Date.now() - t0,
      }
    } catch (err) {
      // Fallback silencieux vers l'API avec hint serveur. On ne log que
      // les fails inattendus (pas le scaffold throw qui est normal).
      const msg = err instanceof Error ? err.message : 'unknown'
      if (msg !== 'WHISPER_LOCAL_NOT_AVAILABLE' && msg !== 'WHISPER_LOCAL_NOT_SUPPORTED') {
        console.warn('[client-transcribe] local failed, falling back API', msg)
      }
      return fetchApiTranscribe(audioBlob, options, t0, ENGINE_HINT_LOCAL_FAILED)
    }
  }

  // ── Étape 3 : routing API direct (mini ou standard, décidé serveur-side) ─
  return fetchApiTranscribe(audioBlob, options, t0, null)
}

/* ─── Helper interne fetch API ─────────────────────────────────────────── */

/**
 * POST `/api/transcribe` avec le body multipart + headers d'observabilité.
 *
 * Le serveur applique son propre routing (mini vs standard) via le même router
 * B58 — on lui passe `meta` en JSON pour qu'il ait toutes les infos.
 */
async function fetchApiTranscribe(
  audioBlob: Blob,
  options: ClientTranscribeOptions,
  startTimestamp: number,
  engineHint: string | null,
): Promise<ClientTranscribeResult> {
  const form = new FormData()
  const ext = audioBlob.type.includes('mp4') ? 'mp4' : 'webm'
  const file = new File([audioBlob], `voice.${ext}`, {
    type: audioBlob.type || 'audio/webm',
  })
  form.append('audio', file)
  form.append('dossierId', options.dossierId)
  if (options.sessionId) {
    form.append('sessionId', options.sessionId)
  }
  // Le serveur lit ce JSON pour décider mini vs standard.
  form.append('meta', JSON.stringify(options.meta))

  const headers: Record<string, string> = {}
  if (engineHint) {
    headers[HEADER_ENGINE_HINT] = engineHint
  }

  const res = await fetch(TRANSCRIBE_API_PATH, {
    method: 'POST',
    body: form,
    headers,
    signal: options.signal,
    credentials: 'same-origin',
  })

  if (!res.ok) {
    let serverMsg = `HTTP ${res.status}`
    try {
      const errBody = (await res.json()) as { error?: string; name?: string }
      if (errBody.error) serverMsg = `${errBody.name ?? 'Error'}: ${errBody.error}`
    } catch {
      /* response non-JSON */
    }
    throw new Error(`transcribe_api_failed: ${serverMsg}`)
  }

  const data = (await res.json()) as {
    transcript?: string
    markedText?: string
    engine?: TranscriptionEngine
    model_used?: string
    costEur?: number
    audioSignedUrl?: string | null
    audioStoragePath?: string | null
    voiceNoteId?: string | null
    segments?: unknown[]
    language?: string
    durationSeconds?: number
  }

  const transcript = (data.markedText || data.transcript || '').trim()
  // Engine attendu côté serveur après mapping : api_whisper_mini ou
  // api_whisper_standard. Si le serveur renvoie autre chose (legacy), on
  // garde la valeur — sinon on fallback sur mini (le défaut éco).
  const engine: TranscriptionEngine = data.engine ?? 'api_whisper_mini'

  return {
    transcript,
    engine,
    model: data.model_used ?? 'gpt-4o-mini-transcribe',
    costEur: data.costEur ?? 0,
    latencyMs: Date.now() - startTimestamp,
    audioSignedUrl: data.audioSignedUrl ?? null,
    audioStoragePath: data.audioStoragePath ?? null,
    voiceNoteId: data.voiceNoteId ?? null,
    segments: data.segments,
    language: data.language,
    durationSeconds: data.durationSeconds,
  }
}

/* ─── Helper exposé : check WASM côté caller sans monter le hook ───────── */

/**
 * Permet à un composant non-React (action serveur côté worker, etc.) de tester
 * le support WASM avant de tenter le routing local. Pour les composants React,
 * préférer `useLocalWhisper()` qui gère aussi le lazy-load du modèle.
 */
export { detectWasmSupport }
