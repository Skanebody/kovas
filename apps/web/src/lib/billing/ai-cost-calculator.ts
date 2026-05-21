/**
 * KOVAS — Pricing pur des appels IA (Claude / OpenAI / Deepgram).
 *
 * Source : CLAUDE.md §7bis stratégie d'autonomisation IA + Anthropic pricing
 * mai 2026 + OpenAI mai 2026.
 *
 * Convention : pricing en USD/MTok (ou USD/min audio), conversion USD → EUR via
 * `USD_TO_EUR_RATE` (variable env, défaut 0.92).
 *
 * Le calcul retourne :
 *   - `costUsd` : valeur USD (debug / monitoring)
 *   - `costEurCents` : centimes EUR (stockage ai_usage_logs.estimated_cost_eur_cents)
 *
 * Cette fonction est PURE (pas d'I/O, pas d'env autre que USD_TO_EUR_RATE) et
 * peut être importée depuis Edge Functions Deno via copie locale ou réécriture.
 */

export type AiProvider = 'anthropic' | 'openai' | 'deepgram'

/** Tarifs USD par MTok (1 000 000 tokens) ou USD par minute audio. */
export interface AiPricingEntry {
  inputUsdPerMTok?: number
  outputUsdPerMTok?: number
  /** Tokens lus depuis cache prompt — moins cher. */
  cachedInputUsdPerMTok?: number
  /** Tokens écrits en cache prompt (premier appel) — typiquement 1.25× input. */
  cacheWriteUsdPerMTok?: number
  /** Pour Whisper / Deepgram. */
  audioUsdPerMinute?: number
}

/**
 * Grille tarifaire de référence (mai 2026).
 * Ces valeurs sont les fallbacks ; en prod elles sont surchargées par variables
 * env `ANTHROPIC_PRICING_*` / `OPENAI_PRICING_*` / `DEEPGRAM_PRICING_*` pour
 * pouvoir ajuster sans redéploiement.
 */
export const AI_PRICING_DEFAULTS: Record<string, AiPricingEntry> = {
  // Anthropic Claude (mai 2026)
  'claude-haiku-4-5': {
    inputUsdPerMTok: 1.0,
    outputUsdPerMTok: 5.0,
    cachedInputUsdPerMTok: 0.1,
    cacheWriteUsdPerMTok: 1.25,
  },
  'claude-sonnet-4-6': {
    inputUsdPerMTok: 3.0,
    outputUsdPerMTok: 15.0,
    cachedInputUsdPerMTok: 0.3,
    cacheWriteUsdPerMTok: 3.75,
  },
  'claude-opus-4-7': {
    inputUsdPerMTok: 15.0,
    outputUsdPerMTok: 75.0,
    cachedInputUsdPerMTok: 1.5,
    cacheWriteUsdPerMTok: 18.75,
  },
  // OpenAI
  'gpt-4o-mini-transcribe': {
    audioUsdPerMinute: 0.006,
  },
  'text-embedding-3-small': {
    inputUsdPerMTok: 0.02,
  },
  // Deepgram
  'nova-3': {
    audioUsdPerMinute: 0.0043,
  },
}

export interface ComputeAiCostInput {
  provider: AiProvider
  model: string
  /** Tokens d'entrée standard (non cached). */
  inputTokens?: number
  outputTokens?: number
  cachedInputTokens?: number
  cacheWriteTokens?: number
  /** Audio durée minutes (Whisper / Deepgram). */
  audioMinutes?: number
  /** Override USD→EUR rate (sinon process.env.USD_TO_EUR_RATE ou 0.92). */
  usdToEurRate?: number
  /** Override pricing entry (sinon AI_PRICING_DEFAULTS[model]). */
  pricingOverride?: AiPricingEntry
}

export interface ComputeAiCostResult {
  costUsd: number
  costEurCents: number
  pricingSource: 'override' | 'default' | 'unknown'
}

/** Lecture USD→EUR rate (env var ou fallback 0.92). */
function readUsdToEurRate(): number {
  if (typeof process !== 'undefined' && process.env?.USD_TO_EUR_RATE) {
    const n = Number(process.env.USD_TO_EUR_RATE)
    if (!Number.isNaN(n) && n > 0 && n < 2) return n
  }
  return 0.92
}

/**
 * Calcule le coût d'un appel IA (USD + EUR cents) à partir des tokens / minutes.
 *
 * Coût USD :
 *   = input_tokens × inputUsdPerMTok / 1e6
 *   + output_tokens × outputUsdPerMTok / 1e6
 *   + cached_input_tokens × cachedInputUsdPerMTok / 1e6
 *   + cache_write_tokens × cacheWriteUsdPerMTok / 1e6
 *   + audio_minutes × audioUsdPerMinute
 *
 * Coût EUR cents = round(costUsd × usdToEurRate × 100).
 *
 * Modèle inconnu (pas dans AI_PRICING_DEFAULTS et pas d'override) → 0 + flag
 * pricingSource='unknown' (logger admin pour ajouter au mapping).
 */
export function computeAiCostEur(input: ComputeAiCostInput): ComputeAiCostResult {
  const pricing = input.pricingOverride ?? AI_PRICING_DEFAULTS[input.model]
  if (!pricing) {
    return { costUsd: 0, costEurCents: 0, pricingSource: 'unknown' }
  }

  const inputTokens = Math.max(input.inputTokens ?? 0, 0)
  const outputTokens = Math.max(input.outputTokens ?? 0, 0)
  const cachedTokens = Math.max(input.cachedInputTokens ?? 0, 0)
  const cacheWriteTokens = Math.max(input.cacheWriteTokens ?? 0, 0)
  const audioMin = Math.max(input.audioMinutes ?? 0, 0)

  let usd = 0
  if (pricing.inputUsdPerMTok) usd += (inputTokens * pricing.inputUsdPerMTok) / 1_000_000
  if (pricing.outputUsdPerMTok) usd += (outputTokens * pricing.outputUsdPerMTok) / 1_000_000
  if (pricing.cachedInputUsdPerMTok)
    usd += (cachedTokens * pricing.cachedInputUsdPerMTok) / 1_000_000
  if (pricing.cacheWriteUsdPerMTok)
    usd += (cacheWriteTokens * pricing.cacheWriteUsdPerMTok) / 1_000_000
  if (pricing.audioUsdPerMinute) usd += audioMin * pricing.audioUsdPerMinute

  const rate = input.usdToEurRate ?? readUsdToEurRate()
  const cents = Math.round(usd * rate * 100)

  return {
    costUsd: usd,
    costEurCents: cents,
    pricingSource: input.pricingOverride ? 'override' : 'default',
  }
}

/**
 * Helper utilitaire : calcule juste le coût en cents EUR.
 */
export function computeAiCostEurCents(input: ComputeAiCostInput): number {
  return computeAiCostEur(input).costEurCents
}
