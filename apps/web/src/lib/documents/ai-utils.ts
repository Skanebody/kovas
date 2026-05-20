/**
 * KOVAS — Document Intelligence : helpers IA partagés.
 *
 * - Retry exponentiel x3 sur 429/5xx Anthropic.
 * - Pricing Haiku 4.5 / Sonnet 4.6 (USD per 1M tokens, conversion EUR via taux fixe).
 * - Helpers parsing JSON robuste (strip markdown fences, fallback).
 *
 * Pattern aligné sur `lib/mission/vision-analyzer.ts`.
 */

import Anthropic from '@anthropic-ai/sdk'

// ============================================
// Pricing — Claude Haiku 4.5 + Sonnet 4.6 (USD per 1M tokens)
// ============================================
// Source : https://www.anthropic.com/pricing — pricing iteration courante.
// EUR conversion via taux fixe 0.93 (cohérent avec lib/document-extractor.ts).
const PRICING = {
  'claude-haiku-4-5': {
    input: 1.0, // $1 / 1M tokens
    cacheWrite: 1.25, // 1.25x input
    cacheRead: 0.1, // 10% input
    output: 5.0, // $5 / 1M tokens
  },
  'claude-sonnet-4-6': {
    input: 3.0, // $3 / 1M tokens
    cacheWrite: 3.75,
    cacheRead: 0.3,
    output: 15.0, // $15 / 1M tokens
  },
  'claude-sonnet-4-5': {
    input: 3.0,
    cacheWrite: 3.75,
    cacheRead: 0.3,
    output: 15.0,
  },
} as const

const USD_TO_EUR = 0.93
const MAX_ATTEMPTS = 3
const BASE_BACKOFF_MS = 800

export interface UsageMetrics {
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
}

export function computeCostUsd(model: string, usage: UsageMetrics): number {
  const tier = PRICING[model as keyof typeof PRICING] ?? PRICING['claude-haiku-4-5']
  const billableInput = Math.max(
    0,
    usage.inputTokens - usage.cacheCreationTokens - usage.cacheReadTokens,
  )
  const cost =
    (billableInput / 1_000_000) * tier.input +
    (usage.cacheCreationTokens / 1_000_000) * tier.cacheWrite +
    (usage.cacheReadTokens / 1_000_000) * tier.cacheRead +
    (usage.outputTokens / 1_000_000) * tier.output
  return Math.round(cost * 1_000_000) / 1_000_000
}

export function usdToEur(usd: number): number {
  return Math.round(usd * USD_TO_EUR * 1_000_000) / 1_000_000
}

/**
 * Exécute un appel Anthropic avec retry exponentiel (3 tentatives max) sur les
 * erreurs réseau, 429 et 5xx. Les erreurs 4xx (sauf 429) ne sont PAS retryées.
 */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (!isRetryable(err) || attempt === MAX_ATTEMPTS) break
      const delay = BASE_BACKOFF_MS * 2 ** (attempt - 1)
      await sleep(delay)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Retry failed: unknown error')
}

function isRetryable(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) {
    if (err.status === 429) return true
    if (typeof err.status === 'number' && err.status >= 500 && err.status < 600) return true
    return false
  }
  // Network errors (fetch failed, ECONNRESET, timeout) — retry.
  return true
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Parse robuste d'une réponse JSON Claude (strip markdown fences, trim).
 */
export function parseJsonResponse(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim()
  return JSON.parse(cleaned)
}

/**
 * Extrait le bloc texte d'une response Anthropic (premier bloc text).
 */
export function extractTextBlock(response: Anthropic.Message): string {
  const block = response.content.find((b): b is Anthropic.TextBlock => b.type === 'text')
  if (!block) {
    throw new Error('Claude returned no text block')
  }
  return block.text
}
