/**
 * KOVAS — RAG / Embeddings OpenAI (text-embedding-3-small, 1536 dim).
 *
 * Module utilitaire pour :
 *  - Générer un embedding sur une chaîne unique (avec cache LRU 24h en mémoire)
 *  - Générer un batch d'embeddings (cap 2048 textes / call OpenAI)
 *  - Retry exponentiel + tracking coût
 *
 * Coût indicatif : 0,02 USD / 1M tokens (text-embedding-3-small).
 *
 * Cache LRU 24h : les mêmes queries reviennent souvent (FAQ "amiante avant 1997 ?"),
 * on évite ainsi de payer 2x le même embedding. Clé = SHA256 du texte normalisé.
 *
 * Authority : CLAUDE.md §8 — IA "OpenAI Whisper" + RAG via OpenAI embeddings, Claude pour génération.
 */

import { createHash } from 'node:crypto'
import OpenAI from 'openai'

const EMBED_MODEL = process.env.OPENAI_MODEL_EMBED ?? 'text-embedding-3-small'
const EMBED_DIMENSIONS = 1536
const OPENAI_BATCH_CAP = 2048
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24h
const CACHE_MAX_ENTRIES = 5_000
const EMBED_COST_USD_PER_MILLION_TOKENS = 0.02
const USD_TO_EUR = 0.93

interface CacheEntry {
  vector: number[]
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

export interface EmbeddingResult {
  vector: number[]
  tokens: number
  costEur: number
  cached: boolean
}

export interface BatchEmbeddingResult {
  vectors: number[][]
  tokens: number
  costEur: number
}

/**
 * Normalise + hashe le texte pour la clé de cache.
 * Trim + collapse whitespace + lowercase (les variations de casse/espacement
 * produisent ~le même embedding, autant économiser les appels).
 */
function cacheKey(text: string): string {
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ')
  return createHash('sha256').update(normalized).digest('hex')
}

function cacheGet(key: string): number[] | null {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    cache.delete(key)
    return null
  }
  return entry.vector
}

function cacheSet(key: string, vector: number[]): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Eviction simple : on supprime la première entrée insérée (FIFO ~ LRU pour notre usage).
    const firstKey = cache.keys().next().value
    if (firstKey) cache.delete(firstKey)
  }
  cache.set(key, { vector, expiresAt: Date.now() + CACHE_TTL_MS })
}

/**
 * Retry exponentiel pour les erreurs réseau / rate-limit (429).
 * 3 tentatives max : 500ms → 1500ms → 4500ms.
 */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      const isLast = attempt === maxAttempts
      if (isLast) break
      const delay = 500 * 3 ** (attempt - 1)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

function computeCostEur(tokens: number): number {
  const usd = (tokens / 1_000_000) * EMBED_COST_USD_PER_MILLION_TOKENS
  return Math.round(usd * USD_TO_EUR * 1_000_000) / 1_000_000
}

function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured')
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

/**
 * Génère un embedding pour un texte unique. Utilise le cache LRU 24h.
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error('generateEmbedding: empty text')
  }

  const key = cacheKey(trimmed)
  const cached = cacheGet(key)
  if (cached) {
    return { vector: cached, tokens: 0, costEur: 0, cached: true }
  }

  const client = getOpenAIClient()
  const response = await withRetry(() =>
    client.embeddings.create({
      model: EMBED_MODEL,
      input: trimmed,
      dimensions: EMBED_DIMENSIONS,
      encoding_format: 'float',
    }),
  )

  const datum = response.data[0]
  if (!datum) {
    throw new Error('OpenAI embedding response empty')
  }

  const vector = datum.embedding
  const tokens = response.usage.total_tokens
  cacheSet(key, vector)

  return {
    vector,
    tokens,
    costEur: computeCostEur(tokens),
    cached: false,
  }
}

/**
 * Génère un batch d'embeddings. Découpe automatiquement si > 2048 textes
 * (cap OpenAI text-embedding-3-small).
 *
 * Cache appliqué texte par texte : seuls les "miss" sont envoyés à OpenAI.
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<BatchEmbeddingResult> {
  if (texts.length === 0) {
    return { vectors: [], tokens: 0, costEur: 0 }
  }

  const trimmed = texts.map((t) => t.trim())
  if (trimmed.some((t) => !t)) {
    throw new Error('generateEmbeddingsBatch: empty text in batch')
  }

  // Détection des cache hits.
  const result: (number[] | null)[] = new Array(trimmed.length).fill(null)
  const missIndices: number[] = []
  const missTexts: string[] = []

  for (let i = 0; i < trimmed.length; i++) {
    const txt = trimmed[i]
    if (!txt) continue
    const key = cacheKey(txt)
    const hit = cacheGet(key)
    if (hit) {
      result[i] = hit
    } else {
      missIndices.push(i)
      missTexts.push(txt)
    }
  }

  if (missTexts.length === 0) {
    return {
      vectors: result.map((v) => {
        if (!v) throw new Error('cache miss after fill — invariant broken')
        return v
      }),
      tokens: 0,
      costEur: 0,
    }
  }

  const client = getOpenAIClient()
  let totalTokens = 0

  // Découpage en chunks de 2048 max
  for (let start = 0; start < missTexts.length; start += OPENAI_BATCH_CAP) {
    const chunk = missTexts.slice(start, start + OPENAI_BATCH_CAP)
    const response = await withRetry(() =>
      client.embeddings.create({
        model: EMBED_MODEL,
        input: chunk,
        dimensions: EMBED_DIMENSIONS,
        encoding_format: 'float',
      }),
    )
    totalTokens += response.usage.total_tokens

    for (let j = 0; j < response.data.length; j++) {
      const datum = response.data[j]
      if (!datum) throw new Error(`OpenAI embedding batch missing index ${j}`)
      const originalIdx = missIndices[start + j]
      if (originalIdx === undefined) throw new Error('originalIdx undefined — invariant broken')
      const text = missTexts[start + j]
      if (!text) throw new Error('missing text — invariant broken')
      result[originalIdx] = datum.embedding
      cacheSet(cacheKey(text), datum.embedding)
    }
  }

  return {
    vectors: result.map((v) => {
      if (!v) throw new Error('result contains null after batch — invariant broken')
      return v
    }),
    tokens: totalTokens,
    costEur: computeCostEur(totalTokens),
  }
}

/**
 * Tronque un texte à ~`maxTokens` (estimation grossière 4 chars/token FR).
 * Pour les très longs documents (arrêtés 100+ pages), on garde le début +
 * le résumé IA (passé séparément en concatenant).
 *
 * V1.5 : remplacer par chunking + multi-vector embeddings.
 */
export function truncateForEmbedding(text: string, maxTokens = 8192): string {
  const maxChars = maxTokens * 4
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n[...tronqué — embedding sur le début du document]`
}

/** Helper test — purge cache. À ne PAS utiliser en prod. */
export function __resetEmbeddingCacheForTests(): void {
  cache.clear()
}

/** Helper monitoring — taille du cache. */
export function getEmbeddingCacheSize(): number {
  return cache.size
}
