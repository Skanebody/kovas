'use client'

/**
 * KOVAS — Stub Whisper local pour le mode terrain Capture-First.
 *
 * V1.5 : on n'embarque PAS whisper.cpp WASM (modèle 100 Mo, perf variable
 * Safari iOS, complexité de chargement). Toutes les transcriptions passent
 * par `/api/transcribe` (Whisper OpenAI server-side).
 *
 * TODO V1.6+ : charger whisper.cpp WASM si :
 *   - device capable (RAM ≥ 4 Go, hardwareConcurrency ≥ 4)
 *   - utilisateur opt-in (préférence terrain mode offline)
 *   - modèle pré-téléchargé en background pendant idle
 *
 * Voir [`docs/ai-autonomy-strategy.md`](docs/ai-autonomy-strategy.md) Phase 3.
 */

export async function isWhisperLocalAvailable(): Promise<boolean> {
  // V1.5 — toujours false. Garde-fou de typage pour l'appelant.
  return false
}

export interface WhisperLocalResult {
  text: string
  durationMs: number
}

export async function transcribeLocally(_audioBlob: Blob): Promise<WhisperLocalResult> {
  throw new Error('WHISPER_LOCAL_NOT_AVAILABLE_YET')
}
