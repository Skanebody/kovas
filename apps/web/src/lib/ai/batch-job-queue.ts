/**
 * KOVAS — Helper Anthropic Batch API (Message Batches).
 *
 * Authority : CLAUDE.md §8 + docs/ai-cost-optimization.md (cette vague).
 *
 * Concept Anthropic Batch API :
 *   - On soumet jusqu'à 100k requêtes en 1 batch (max 100MB body).
 *   - Anthropic les traite sous 24h (souvent < 1h en heures creuses).
 *   - Tarif = 50% du coût standard (input ET output).
 *   - Pas de cache_control sur les batches (les caches ne sont pas partagés).
 *
 * Use case KOVAS : veille réglementaire nocturne. On détecte les nouveaux documents
 * via regulatory-watcher (cron horaire) mais on lance l'analyse Claude en batch
 * la nuit (cron 01:00 → regulatory-batch-analyze) puis on poll les résultats
 * toutes les heures (batch-results-poller).
 *
 * NB : ce fichier vit côté Node (Next.js API routes potentielles + tests).
 * Les Edge Functions Deno dupliquent les types nécessaires (Deno isolate sans Node).
 */

import { ANTHROPIC_MODELS, type AnthropicTier } from './anthropic-config'

/** Statut Anthropic Batch (api `processing_status`). */
export type BatchProcessingStatus = 'in_progress' | 'canceling' | 'ended'

/** Result type per-request (api `result.type`). */
export type BatchResultType = 'succeeded' | 'errored' | 'canceled' | 'expired'

/** Payload de soumission d'un batch (limite : 100k requests, 100MB). */
export interface BatchRequest {
  custom_id: string
  params: {
    model: string
    max_tokens: number
    messages: Array<{ role: 'user' | 'assistant'; content: unknown }>
    system?: unknown
    tools?: unknown[]
    tool_choice?: unknown
    metadata?: Record<string, unknown>
  }
}

export interface BatchSummary {
  id: string
  processing_status: BatchProcessingStatus
  request_counts?: {
    processing: number
    succeeded: number
    errored: number
    canceled: number
    expired: number
  }
  created_at: string
  ended_at: string | null
  expires_at: string | null
  results_url: string | null
}

/**
 * Construit un BatchRequest standardisé.
 * Le custom_id sera échoué tel quel dans la réponse → utiliser un identifiant
 * stable (UUID d'un row DB), max 64 chars.
 */
export function buildBatchRequest(params: {
  customId: string
  tier: AnthropicTier
  maxTokens: number
  systemBlocks: unknown
  userContent: unknown
  tools?: unknown[]
  toolChoice?: unknown
  metadata?: Record<string, unknown>
}): BatchRequest {
  if (params.customId.length > 64) {
    throw new Error(`custom_id too long (${params.customId.length} > 64): ${params.customId}`)
  }
  const req: BatchRequest = {
    custom_id: params.customId,
    params: {
      model: ANTHROPIC_MODELS[params.tier],
      max_tokens: params.maxTokens,
      messages: [{ role: 'user', content: params.userContent }],
    },
  }
  if (params.systemBlocks !== undefined) {
    req.params.system = params.systemBlocks
  }
  if (params.tools && params.tools.length > 0) {
    req.params.tools = params.tools
  }
  if (params.toolChoice !== undefined) {
    req.params.tool_choice = params.toolChoice
  }
  if (params.metadata !== undefined) {
    req.params.metadata = params.metadata
  }
  return req
}

/** Capacité max d'un batch (API contract). */
export const MAX_BATCH_REQUESTS = 100_000
export const MAX_BATCH_BYTES = 100 * 1024 * 1024 // 100MB

/**
 * Découpe une liste de requests en sous-batches respectant les limites Anthropic.
 * KOVAS ne devrait jamais dépasser 1000 requests par nuit → 1 batch suffit en
 * pratique, mais utilitaire prêt si on scale.
 */
export function chunkBatchRequests(requests: BatchRequest[]): BatchRequest[][] {
  if (requests.length === 0) return []
  // Chunking simple par nombre. La taille bytes est typique 1-5KB/req → bien sous 100MB.
  const chunks: BatchRequest[][] = []
  for (let i = 0; i < requests.length; i += MAX_BATCH_REQUESTS) {
    chunks.push(requests.slice(i, i + MAX_BATCH_REQUESTS))
  }
  return chunks
}

/**
 * Représentation interne d'un job batch en DB (côté regulatory_documents.batch_*).
 * Sert de doc/contrat — les Edge Functions Deno re-déclarent.
 */
export interface BatchDocLinkage {
  documentId: string
  batchJobId: string
  batchSubmittedAt: string
  batchCompletedAt: string | null
}

/**
 * Soumet un batch via fetch direct (sans SDK pour rester compatible Edge/Deno).
 * Endpoint : https://api.anthropic.com/v1/messages/batches
 *
 * @returns id du batch + status initial.
 */
export async function submitBatch(params: {
  apiKey: string
  requests: BatchRequest[]
}): Promise<{ id: string; processing_status: BatchProcessingStatus }> {
  if (params.requests.length === 0) {
    throw new Error('submitBatch: requests cannot be empty')
  }
  if (params.requests.length > MAX_BATCH_REQUESTS) {
    throw new Error(
      `submitBatch: too many requests (${params.requests.length} > ${MAX_BATCH_REQUESTS})`,
    )
  }
  const res = await fetch('https://api.anthropic.com/v1/messages/batches', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': params.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'message-batches-2024-09-24',
    },
    body: JSON.stringify({ requests: params.requests }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`submitBatch HTTP ${res.status}: ${errText.slice(0, 500)}`)
  }
  const json = (await res.json()) as { id: string; processing_status: BatchProcessingStatus }
  return json
}

/** Récupère le statut d'un batch. */
export async function retrieveBatch(params: {
  apiKey: string
  batchId: string
}): Promise<BatchSummary> {
  const res = await fetch(`https://api.anthropic.com/v1/messages/batches/${params.batchId}`, {
    method: 'GET',
    headers: {
      'x-api-key': params.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'message-batches-2024-09-24',
    },
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`retrieveBatch HTTP ${res.status}: ${errText.slice(0, 500)}`)
  }
  return (await res.json()) as BatchSummary
}

/**
 * Itère sur les résultats d'un batch terminé (NDJSON streaming).
 *
 * Format ligne :
 *   { custom_id, result: { type: 'succeeded', message: { content, usage } } | { type: 'errored', error: {...} } }
 */
export interface BatchResultLine {
  custom_id: string
  result:
    | {
        type: 'succeeded'
        message: {
          content: Array<{ type: string; name?: string; input?: unknown; text?: string }>
          usage: {
            input_tokens: number
            output_tokens: number
            cache_creation_input_tokens?: number
            cache_read_input_tokens?: number
          }
        }
      }
    | { type: 'errored'; error: { type: string; message: string } }
    | { type: 'canceled' }
    | { type: 'expired' }
}

export async function* iterateBatchResults(params: {
  apiKey: string
  batchId: string
}): AsyncGenerator<BatchResultLine, void, unknown> {
  const res = await fetch(
    `https://api.anthropic.com/v1/messages/batches/${params.batchId}/results`,
    {
      method: 'GET',
      headers: {
        'x-api-key': params.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'message-batches-2024-09-24',
      },
    },
  )
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`iterateBatchResults HTTP ${res.status}: ${errText.slice(0, 500)}`)
  }
  if (!res.body) {
    throw new Error('iterateBatchResults: empty body')
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        yield JSON.parse(trimmed) as BatchResultLine
      } catch (err) {
        console.warn('[batch-job-queue] invalid NDJSON line:', err)
      }
    }
  }
  if (buffer.trim()) {
    try {
      yield JSON.parse(buffer.trim()) as BatchResultLine
    } catch (err) {
      console.warn('[batch-job-queue] final NDJSON line invalid:', err)
    }
  }
}
