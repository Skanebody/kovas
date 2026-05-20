/**
 * KOVAS — Document Intelligence : base commune des extracteurs.
 *
 * Tous les extracteurs (DPE, chaudière, facture énergie, plan) partagent :
 *   - construction d'un content block PDF ou image
 *   - appel Anthropic avec retry
 *   - parse JSON strict via Zod (zéro any)
 *   - log usage IA dans ai_usage_log
 *   - cost tracking
 *
 * Ce module factorise tout cela.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { z } from 'zod'
import {
  computeCostUsd,
  extractTextBlock,
  parseJsonResponse,
  usdToEur,
  withRetry,
} from '../ai-utils'
import { logAiUsage } from '../document-classifier'

export interface ExtractorResult<T> {
  data: T
  costEur: number
  costUsd: number
  model: string
  durationMs: number
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
}

export class ExtractionError extends Error {
  readonly code:
    | 'config_missing'
    | 'unsupported_mime'
    | 'api_failed'
    | 'parse_failed'
    | 'not_implemented'

  constructor(message: string, code: ExtractionError['code']) {
    super(message)
    this.name = 'ExtractionError'
    this.code = code
  }
}

export interface ExtractorRunInput<T> {
  documentId: string
  imageBase64: string
  mimeType: string
  /** Modèle Claude à utiliser (Sonnet pour extraction précise, Haiku pour OCR brut). */
  model: string
  /** Prompt système (régles + JSON schema). */
  systemPrompt: string
  /** Schéma Zod pour valider la sortie. */
  schema: z.ZodSchema<T>
  /** Identifiant d'opération pour ai_usage_log (ex 'extract_dpe'). */
  operation: string
  /** Max tokens output. */
  maxTokens?: number
  supabase: SupabaseClient
}

/**
 * Lance une extraction. Marque le document en status='extracting' avant l'appel,
 * puis logge dans ai_usage_log.
 */
export async function runExtractor<T>(input: ExtractorRunInput<T>): Promise<ExtractorResult<T>> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new ExtractionError('ANTHROPIC_API_KEY not configured', 'config_missing')
  }

  const isPdf = input.mimeType === 'application/pdf'
  const isImage = input.mimeType.startsWith('image/')
  if (!isPdf && !isImage) {
    throw new ExtractionError(`Type ${input.mimeType} non supporté`, 'unsupported_mime')
  }

  // 1. status='extracting'
  await input.supabase
    // biome-ignore lint/suspicious/noExplicitAny: table `documents` pas encore dans le type Database généré
    .from('documents' as any)
    .update({ status: 'extracting' })
    .eq('id', input.documentId)

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // biome-ignore lint/suspicious/noExplicitAny: union complexe Anthropic content blocks
  const docBlock: any = isPdf
    ? {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: input.imageBase64 },
      }
    : {
        type: 'image',
        source: { type: 'base64', media_type: input.mimeType, data: input.imageBase64 },
      }

  const t0 = Date.now()
  let response: Anthropic.Message
  try {
    response = await withRetry(() =>
      client.messages.create({
        model: input.model,
        max_tokens: input.maxTokens ?? 4096,
        system: [
          {
            type: 'text',
            text: input.systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: [
          {
            role: 'user',
            content: [
              docBlock,
              {
                type: 'text',
                text: 'Extrait les données du document. Retourne UNIQUEMENT le JSON conforme au schéma.',
              },
            ],
          },
        ],
      }),
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown'
    await logAiUsage(input.supabase, {
      documentId: input.documentId,
      operation: input.operation,
      model: input.model,
      inputTokens: 0,
      outputTokens: 0,
      costEur: 0,
      durationMs: Date.now() - t0,
      success: false,
      errorMessage: msg,
    })
    throw new ExtractionError(`Anthropic API failed: ${msg}`, 'api_failed')
  }

  const durationMs = Date.now() - t0

  // 2. Parse JSON
  const raw = extractTextBlock(response)
  let parsed: unknown
  try {
    parsed = parseJsonResponse(raw)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'parse error'
    await logAiUsage(input.supabase, {
      documentId: input.documentId,
      operation: input.operation,
      model: input.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      costEur: 0,
      durationMs,
      success: false,
      errorMessage: msg,
    })
    throw new ExtractionError(`JSON parse failed: ${msg}`, 'parse_failed')
  }

  // 3. Validate avec Zod (strict)
  const parseResult = input.schema.safeParse(parsed)
  if (!parseResult.success) {
    const issues = parseResult.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join(' ; ')
    await logAiUsage(input.supabase, {
      documentId: input.documentId,
      operation: input.operation,
      model: input.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      costEur: 0,
      durationMs,
      success: false,
      errorMessage: `Zod validation failed: ${issues}`,
    })
    throw new ExtractionError(`Schema validation failed: ${issues}`, 'parse_failed')
  }

  // 4. Compute cost + log
  const usage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
  }
  const costUsd = computeCostUsd(input.model, usage)
  const costEur = usdToEur(costUsd)

  await logAiUsage(input.supabase, {
    documentId: input.documentId,
    operation: input.operation,
    model: input.model,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    costEur,
    durationMs,
    success: true,
  })

  return {
    data: parseResult.data,
    costEur,
    costUsd,
    model: input.model,
    durationMs,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheCreationTokens: usage.cacheCreationTokens,
    cacheReadTokens: usage.cacheReadTokens,
  }
}
