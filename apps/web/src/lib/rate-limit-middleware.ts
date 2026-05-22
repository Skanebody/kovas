/**
 * Helper rate-limit middleware — KOVAS App
 * ─────────────────────────────────────────────────────────────
 * Utilitaires prêts à brancher dans une API route Next.js (App Router).
 *
 * Exemple d'usage :
 *
 *   import { enforceRateLimit } from '@/lib/rate-limit-middleware'
 *
 *   export async function POST(request: NextRequest) {
 *     const limited = await enforceRateLimit(request, 'public')
 *     if (limited) return limited
 *     // ... reste du handler
 *   }
 *
 * Cf. docs/SECURITY.md > "Rate limiting tiers".
 */

import { type NextRequest, NextResponse } from 'next/server'
import { checkRateLimit, type RateLimitTier } from './rate-limit'

/**
 * Extrait un identifiant pour rate-limiting depuis la requête :
 *  - tente d'abord l'IP réelle via x-forwarded-for (Vercel/Cloudflare)
 *  - fallback x-real-ip
 *  - dernier recours : 'anonymous' (réservé tier public en dev)
 */
function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // Premier item = client réel (ordre = client, proxy1, proxy2, ...)
    return forwarded.split(',')[0]?.trim() ?? 'anonymous'
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }
  return 'anonymous'
}

/**
 * Construit une réponse HTTP 429 (Too Many Requests) avec les headers
 * standards de rate-limiting.
 */
function buildRateLimitedResponse(result: {
  limit: number
  remaining: number
  reset: number
}): NextResponse {
  const retryAfterSeconds = Math.max(0, Math.ceil((result.reset - Date.now()) / 1000))

  return NextResponse.json(
    {
      error: 'rate_limited',
      message:
        'Trop de requêtes en peu de temps. Veuillez patienter avant de réessayer.',
      retryAfter: retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(result.reset),
        'Retry-After': String(retryAfterSeconds),
      },
    },
  )
}

/**
 * Vérifie le rate limit et retourne :
 *  - `null` si la requête est autorisée (continuer le handler)
 *  - une `NextResponse` 429 prête à être renvoyée si plafond atteint
 *
 * @param request    NextRequest de l'API route
 * @param tier       Tier à appliquer (public / authenticated / expensive)
 * @param identifier Optionnel — override de l'identifiant (ex : user_id
 *                   pour les tiers authentifiés). Par défaut : IP client.
 */
export async function enforceRateLimit(
  request: NextRequest,
  tier: RateLimitTier,
  identifier?: string,
): Promise<NextResponse | null> {
  const id = identifier ?? getClientIdentifier(request)
  const result = await checkRateLimit(tier, id)

  if (!result.success) {
    return buildRateLimitedResponse(result)
  }
  return null
}
