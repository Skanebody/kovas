/**
 * KOVAS — Wrapper cost-tracker pour Anthropic / OpenAI.
 *
 * Authority : CLAUDE.md §7bis + docs/ai-cost-optimization.md.
 *
 * Pattern : après chaque appel anthropic.messages.create() / openai.embeddings.create(),
 * on appelle trackAnthropicCall(...) qui :
 *   1. calcule le coût EUR via anthropic-config
 *   2. POST vers l'Edge Function `ai-usage-tracker` (créée par autre agent — Vague 4)
 *      qui INSERT dans ai_usage_log + met à jour les quotas user_usage_quotas.
 *
 * Si l'Edge Function n'est pas dispo (404), fallback INSERT direct dans ai_usage_log
 * via supabase-js — l'audit ne doit JAMAIS être bloquant pour la requête métier.
 */

import {
  computeAnthropicCostEur,
  computeAnthropicBatchCostEur,
  computeOpenAIEmbeddingCostEur,
  type Feature,
  type AnthropicTier,
} from './anthropic-config'

/** Structure usage Anthropic (miroir SDK). */
export interface AnthropicUsageBlock {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

export interface TrackAnthropicParams {
  organizationId: string
  userId: string | null
  feature: Feature
  modelUsed: string
  usage: AnthropicUsageBlock
  /** True si l'appel a été fait via Batch API (coût ×0.5). */
  batch?: boolean
  latencyMs?: number
  success?: boolean
  errorMessage?: string | null
}

export interface TrackOpenAIEmbeddingParams {
  organizationId: string
  userId: string | null
  feature: Feature
  modelUsed: string
  totalTokens: number
  latencyMs?: number
}

/**
 * Calcule et envoie le tracking côté Edge Function `ai-usage-tracker`.
 * Best-effort : les erreurs réseau sont catchées et loggées, jamais rethrow.
 */
export async function trackAnthropicCall(params: TrackAnthropicParams): Promise<void> {
  const tokens = {
    input: params.usage.input_tokens,
    output: params.usage.output_tokens,
    cached: params.usage.cache_read_input_tokens ?? 0,
    cacheWrite: params.usage.cache_creation_input_tokens ?? 0,
  }
  const costEur = params.batch
    ? computeAnthropicBatchCostEur(params.modelUsed, tokens)
    : computeAnthropicCostEur(params.modelUsed, tokens)

  await postUsageTracker({
    organizationId: params.organizationId,
    userId: params.userId,
    feature: params.feature,
    provider: 'anthropic',
    modelUsed: params.modelUsed,
    inputTokens: params.usage.input_tokens,
    outputTokens: params.usage.output_tokens,
    cachedInputTokens: params.usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: params.usage.cache_creation_input_tokens ?? 0,
    estimatedCostEur: costEur,
    latencyMs: params.latencyMs ?? null,
    batch: params.batch ?? false,
    success: params.success ?? true,
    errorMessage: params.errorMessage ?? null,
  })
}

export async function trackOpenAIEmbeddingCall(
  params: TrackOpenAIEmbeddingParams,
): Promise<void> {
  const costEur = computeOpenAIEmbeddingCostEur(params.modelUsed, params.totalTokens)
  await postUsageTracker({
    organizationId: params.organizationId,
    userId: params.userId,
    feature: params.feature,
    provider: 'openai',
    modelUsed: params.modelUsed,
    inputTokens: params.totalTokens,
    outputTokens: 0,
    cachedInputTokens: 0,
    cacheWriteTokens: 0,
    estimatedCostEur: costEur,
    latencyMs: params.latencyMs ?? null,
    batch: false,
    success: true,
    errorMessage: null,
  })
}

interface UsageTrackerPayload {
  organizationId: string
  userId: string | null
  feature: Feature
  provider: 'anthropic' | 'openai' | 'deepgram' | 'whisper'
  modelUsed: string
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  cacheWriteTokens: number
  estimatedCostEur: number
  latencyMs: number | null
  batch: boolean
  success: boolean
  errorMessage: string | null
}

async function postUsageTracker(payload: UsageTrackerPayload): Promise<void> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.warn('[cost-tracker] missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — usage not tracked')
    return
  }
  try {
    const res = await fetch(`${url}/functions/v1/ai-usage-tracker`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      // 404 = Edge Function pas encore déployée → fallback silencieux.
      // 5xx = transient → on log mais on n'échoue pas.
      console.warn(
        `[cost-tracker] ai-usage-tracker returned ${res.status} for feature='${payload.feature}'`,
      )
    }
  } catch (err) {
    console.warn(
      `[cost-tracker] ai-usage-tracker fetch failed: ${err instanceof Error ? err.message : 'unknown'}`,
    )
  }
}

/** Convenience helper pour les Edge Functions Deno qui veulent un coût rapide. */
export function quickCostEur(params: {
  modelUsed: string
  usage: AnthropicUsageBlock
  batch?: boolean
}): number {
  const tokens = {
    input: params.usage.input_tokens,
    output: params.usage.output_tokens,
    cached: params.usage.cache_read_input_tokens ?? 0,
    cacheWrite: params.usage.cache_creation_input_tokens ?? 0,
  }
  return params.batch
    ? computeAnthropicBatchCostEur(params.modelUsed, tokens)
    : computeAnthropicCostEur(params.modelUsed, tokens)
}

/** Re-export des tiers pour usage simplifié des callers. */
export type { AnthropicTier }
