import OpenAI from 'openai'

/**
 * Wrapper OpenAI Whisper API.
 * Cf. research/whisper-transcription.md
 *
 * Modèle par défaut : gpt-4o-mini-transcribe (~$0.003/min, mieux que whisper-1)
 * Fallback : Deepgram Nova-3 EU Frankfurt (cf. createDeepgramClient ci-dessous)
 */

export function createOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY missing')
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })
}

export const WHISPER_MODEL = process.env.OPENAI_MODEL_TRANSCRIBE ?? 'gpt-4o-mini-transcribe'

export type TranscriptionResult = {
  transcript: string
  provider: 'openai' | 'deepgram'
  latencyMs: number
  costEur: number
}

/**
 * Transcription avec fallback Deepgram si OpenAI 5xx ou > 8s.
 * Stub — implémentation complète dans Edge Function `transcribe-voice-note`.
 */
export async function transcribeAudio(
  audioBlob: Blob,
  missionType: string,
): Promise<TranscriptionResult> {
  // TODO Task 2.3 sprint MVP J5
  throw new Error('Not implemented yet — Task 2.3 sprint MVP')
}
