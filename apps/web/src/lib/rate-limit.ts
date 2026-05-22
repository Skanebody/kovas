/**
 * Rate limiting — KOVAS App
 * ─────────────────────────────────────────────────────────────
 * Implémentation sliding-window via Upstash Redis serverless.
 * 3 tiers selon la criticité de l'endpoint :
 *
 *   - `public`        : formulaires non authentifiés (contact, signup,
 *                       upload propriétaire). Très restrictif.
 *   - `authenticated` : API authentifiées (CRUD missions/clients/biens,
 *                       sync queue, fetches dashboard). Confortable.
 *   - `expensive`     : opérations coûteuses (Whisper transcription,
 *                       Claude inference, génération PDF, export ZIP
 *                       Liciel). Cap horaire serré.
 *
 * Variables d'environnement requises :
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * Cf. docs/SECURITY.md > "Rate limiting tiers".
 */

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

/**
 * Redis client partagé. Lazy-init pour éviter de planter le build si
 * les variables ne sont pas encore configurées (Vercel preview).
 */
function getRedisClient(): Redis | null {
  if (!REDIS_URL || !REDIS_TOKEN) {
    return null
  }
  return new Redis({
    url: REDIS_URL,
    token: REDIS_TOKEN,
  })
}

const redis = getRedisClient()

/**
 * Tier public — formulaires non authentifiés.
 * 10 requêtes par fenêtre glissante de 10 secondes / IP.
 */
export const publicLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '10 s'),
      analytics: true,
      prefix: 'kovas:rl:public',
    })
  : null

/**
 * Tier authentifié — API CRUD standard.
 * 60 requêtes par fenêtre glissante de 1 minute / user.
 */
export const authenticatedLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      analytics: true,
      prefix: 'kovas:rl:authenticated',
    })
  : null

/**
 * Tier coûteux — IA Whisper/Claude, génération PDF, exports.
 * 20 requêtes par fenêtre glissante de 1 heure / user.
 */
export const expensiveLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, '1 h'),
      analytics: true,
      prefix: 'kovas:rl:expensive',
    })
  : null

export type RateLimitTier = 'public' | 'authenticated' | 'expensive'

/**
 * Retourne le limiter correspondant au tier demandé, ou null si Redis
 * n'est pas configuré (mode dev sans Upstash ou Vercel preview).
 */
export function getLimiter(tier: RateLimitTier): Ratelimit | null {
  switch (tier) {
    case 'public':
      return publicLimiter
    case 'authenticated':
      return authenticatedLimiter
    case 'expensive':
      return expensiveLimiter
  }
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Vérifie le rate limit pour un identifiant (IP ou user_id selon le tier)
 * et retourne le résultat. Si Redis n'est pas configuré, autorise tout
 * (fail-open en dev — fail-closed en prod doit être garanti côté infra).
 */
export async function checkRateLimit(
  tier: RateLimitTier,
  identifier: string,
): Promise<RateLimitResult> {
  const limiter = getLimiter(tier)
  if (!limiter) {
    // Pas de Redis : on log mais on n'écrase pas la requête en dev.
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[rate-limit] Upstash Redis non configuré en production. Configurer UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.',
      )
    }
    return { success: true, limit: 0, remaining: 0, reset: 0 }
  }

  const { success, limit, remaining, reset } = await limiter.limit(identifier)
  return { success, limit, remaining, reset }
}
