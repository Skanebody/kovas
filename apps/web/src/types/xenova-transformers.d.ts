/**
 * KOVAS — Déclaration ambient minimale pour `@xenova/transformers` (Lot B99).
 *
 * Pourquoi : la lib `@xenova/transformers` v2.x publie ses propres types
 * `dist/types/transformers.d.ts` qui exposent un pipeline ASR très permissif.
 * On déclare ici un sous-ensemble minimal qui :
 *
 *   1. Permet à TypeScript de compiler MÊME si la dep n'est pas encore
 *      installée localement (CI clone fresh, sandbox sans pnpm, etc.).
 *   2. Documente le contrat utilisé par `use-local-whisper.ts` (pipeline
 *      `automatic-speech-recognition` + `env` global).
 *
 * Quand la dep est installée, les vraies déclarations de la lib prennent
 * le pas (TypeScript merge les module declarations). Cette ambient agit
 * comme un filet de sécurité côté DX + CI typecheck.
 *
 * Source officielle :
 *   https://github.com/xenova/transformers.js/blob/v2/src/pipelines.js
 */

declare module '@xenova/transformers' {
  /**
   * Result d'un pipeline ASR. La lib retourne soit un objet unique, soit
   * un array de chunks selon la durée de l'audio (chunking interne 30s).
   */
  export interface AsrResult {
    text?: string
    chunks?: Array<{ timestamp: [number, number]; text: string }>
  }

  /**
   * Pipeline ASR construit par `pipeline('automatic-speech-recognition', ...)`.
   * Appelable directement avec un Float32Array (16kHz mono attendu).
   */
  export type AsrPipeline = (
    audio: Float32Array,
    options?: {
      language?: string
      task?: 'transcribe' | 'translate'
      return_timestamps?: boolean
      chunk_length_s?: number
      stride_length_s?: number
    },
  ) => Promise<AsrResult | AsrResult[]>

  /**
   * Factory officielle. Pour KOVAS on utilise UNIQUEMENT le task
   * `automatic-speech-recognition`.
   */
  export function pipeline(
    task: 'automatic-speech-recognition',
    model: string,
    options?: { quantized?: boolean },
  ): Promise<AsrPipeline>

  export function pipeline(
    task: string,
    model: string,
    options?: Record<string, unknown>,
  ): Promise<unknown>

  /**
   * Config globale (cache, CDN, local files).
   * `allowLocalModels=false` + `useBrowserCache=true` = config KOVAS canonique.
   */
  export const env: {
    allowLocalModels?: boolean
    useBrowserCache?: boolean
    [key: string]: unknown
  }
}
