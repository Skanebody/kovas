/**
 * KOVAS — Rate limiter pour l'API publique v1.
 *
 * Stratégie cascade :
 *   1. Si UPSTASH_REDIS_REST_URL + TOKEN définis → Upstash Redis sliding window
 *      (production-grade, distribué, persistent).
 *   2. Sinon → in-memory Map (dev / staging / fallback).
 *
 * Limites par défaut (override via params) :
 *   - Anonyme (IP)   : 60 requêtes / minute
 *   - Avec API key   : 600 requêtes / minute
 *
 * Headers retournés (toujours, même en succès) :
 *   - X-RateLimit-Limit
 *   - X-RateLimit-Remaining
 *   - X-RateLimit-Reset (epoch seconds)
 *   - Retry-After (seconds, si 429)
 *
 * Authority : REFONTE-ACQUI-TARGET-V2 §10 API publique.
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL ?? ''
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? ''
const UPSTASH_ENABLED = Boolean(UPSTASH_URL && UPSTASH_TOKEN)

const ANON_LIMIT = 60
const API_KEY_LIMIT = 600
const WINDOW_SECONDS = 60

export interface RateLimitConfig {
  /** Préfixe Redis (ex: 'api:property') pour différencier les compteurs par endpoint */
  prefix: string
  /** Limite override (sinon défaut anon / api-key) */
  limit?: number
  /** Fenêtre en secondes (défaut 60) */
  windowSeconds?: number
}

export interface RateLimitResult {
  /** Si false, refuser la requête avec status 429 */
  allowed: boolean
  /** Limite applicable */
  limit: number
  /** Requêtes restantes dans la fenêtre */
  remaining: number
  /** Epoch seconds où la fenêtre se réinitialise */
  reset_at: number
  /** Secondes avant la prochaine requête possible (si refusée) */
  retry_after: number
  /** Identifie comment la limite a été enforcée */
  source: 'upstash' | 'memory' | 'disabled'
}

/**
 * In-memory fallback — Map<key, { count, resetAt }>.
 * Réinitialisé à chaque hot-reload Next.js (acceptable pour dev/staging).
 */
const memoryStore = new Map<string, { count: number; resetAt: number }>()

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

function extractIdentifier(request: Request): { id: string; isApiKey: boolean } {
  const apiKey = request.headers.get('x-api-key')
  if (apiKey && apiKey.length >= 16) {
    return { id: `key:${apiKey.slice(0, 16)}`, isApiKey: true }
  }
  // Fallback IP — Vercel/Cloudflare forwarded headers
  const forwarded =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip')?.trim() ??
    'unknown'
  return { id: `ip:${forwarded}`, isApiKey: false }
}

async function upstashIncr(key: string, ttlSeconds: number): Promise<number> {
  // Upstash REST API : INCR + EXPIRE en pipeline
  const pipelineBody = JSON.stringify([
    ['INCR', key],
    ['EXPIRE', key, String(ttlSeconds), 'NX'],
  ])
  const response = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: pipelineBody,
  })
  if (!response.ok) {
    throw new Error(`Upstash pipeline ${response.status}`)
  }
  const data = (await response.json()) as Array<{ result: number }>
  return data[0]?.result ?? 0
}

function memoryIncr(key: string, ttlSeconds: number): { count: number; resetAt: number } {
  const now = nowSeconds()
  const existing = memoryStore.get(key)
  if (!existing || existing.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + ttlSeconds }
    memoryStore.set(key, fresh)
    return fresh
  }
  existing.count += 1
  return existing
}

export async function checkRateLimit(
  request: Request,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const { id, isApiKey } = extractIdentifier(request)
  const limit = config.limit ?? (isApiKey ? API_KEY_LIMIT : ANON_LIMIT)
  const windowSeconds = config.windowSeconds ?? WINDOW_SECONDS
  const key = `${config.prefix}:${id}`

  if (UPSTASH_ENABLED) {
    try {
      const count = await upstashIncr(key, windowSeconds)
      const resetAt = nowSeconds() + windowSeconds
      const allowed = count <= limit
      return {
        allowed,
        limit,
        remaining: Math.max(0, limit - count),
        reset_at: resetAt,
        retry_after: allowed ? 0 : windowSeconds,
        source: 'upstash',
      }
    } catch (err) {
      console.warn('[rate-limit] Upstash error, fallback memory:', err)
    }
  }

  // Memory fallback
  const entry = memoryIncr(key, windowSeconds)
  const allowed = entry.count <= limit
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - entry.count),
    reset_at: entry.resetAt,
    retry_after: allowed ? 0 : Math.max(1, entry.resetAt - nowSeconds()),
    source: UPSTASH_ENABLED ? 'memory' : 'memory',
  }
}

/**
 * Helper : construit les headers HTTP standards depuis un RateLimitResult.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(result.reset_at),
    'X-RateLimit-Source': result.source,
  }
  if (!result.allowed) {
    headers['Retry-After'] = String(result.retry_after)
  }
  return headers
}
