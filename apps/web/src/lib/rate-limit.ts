/**
 * Rate limiting — KOVAS App
 * ─────────────────────────────────────────────────────────────
 * Implémentation sliding-window via Upstash Redis serverless.
 * 5 tiers selon la criticité de l'endpoint :
 *
 *   - `public`        : formulaires non authentifiés (contact, signup,
 *                       upload propriétaire). Très restrictif.
 *   - `authenticated` : API authentifiées (CRUD missions/clients/biens,
 *                       sync queue, fetches dashboard). Confortable.
 *   - `expensive`     : opérations coûteuses (Whisper transcription,
 *                       Claude inference, génération PDF, export ZIP
 *                       Liciel). Cap horaire serré.
 *   - `auth`          : login / signup / OAuth callback. Anti brute-force
 *                       et credential stuffing. 10 req / 15 min / identifier
 *                       (email ou IP selon contexte).
 *   - `auth_strict`   : password reset, OTP SMS / email send, claim KYC
 *                       (coûts Brevo + risque brute force OTP). Très restrictif.
 *                       3 req / 15 min / identifier.
 *
 * Variables d'environnement requises :
 *   UPSTASH_REDIS_REST_URL
 *   UPSTASH_REDIS_REST_TOKEN
 *
 * Comportement si Upstash absent :
 *   - En production : FAIL-CLOSED (success=false) — évite qu'une mauvaise
 *     config Vercel preview promue en prod fasse disparaître toute la
 *     protection rate-limit silencieusement.
 *   - En dev / preview : FAIL-OPEN soft (success=true + log warn).
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

/**
 * Tier auth — login / signup / OAuth callback.
 * 10 requêtes par fenêtre glissante de 15 minutes / identifier (email ou IP).
 * Anti brute-force credentials + credential-stuffing par email.
 */
export const authLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '15 m'),
      analytics: true,
      prefix: 'kovas:rl:auth',
    })
  : null

/**
 * Tier auth_strict — password reset, OTP send (email/SMS), claim KYC.
 * 3 requêtes par fenêtre glissante de 15 minutes / identifier.
 * Anti brute-force OTP + protection coût Brevo SMS.
 */
export const authStrictLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(3, '15 m'),
      analytics: true,
      prefix: 'kovas:rl:auth_strict',
    })
  : null

export type RateLimitTier = 'public' | 'authenticated' | 'expensive' | 'auth' | 'auth_strict'

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
    case 'auth':
      return authLimiter
    case 'auth_strict':
      return authStrictLimiter
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
 * et retourne le résultat.
 *
 * Comportement si Redis absent :
 *  - production → FAIL-CLOSED (success=false). Une mauvaise config Vercel
 *    promue en prod doit faire échouer les appels au lieu de tout laisser passer.
 *  - dev / preview → FAIL-OPEN soft (success=true + log warn).
 */
export async function checkRateLimit(
  tier: RateLimitTier,
  identifier: string,
): Promise<RateLimitResult> {
  const limiter = getLimiter(tier)
  if (!limiter) {
    if (process.env.NODE_ENV === 'production') {
      console.error(
        '[rate-limit] CRITICAL: Upstash Redis non configuré en production. ' +
          'Toutes les requêtes rate-limitées sont rejetées (fail-closed). ' +
          'Configurer UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN sur Vercel.',
      )
      return {
        success: false,
        limit: 0,
        remaining: 0,
        reset: Date.now() + 60_000,
      }
    }
    // dev / preview : fail-open soft
    console.warn('[rate-limit] Upstash Redis non configuré (dev/preview). Fail-open soft.')
    return { success: true, limit: 0, remaining: 0, reset: 0 }
  }

  const { success, limit, remaining, reset } = await limiter.limit(identifier)
  return { success, limit, remaining, reset }
}
