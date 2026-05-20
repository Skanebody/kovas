/**
 * Cookie de validation 2FA admin.
 *
 * Encode : userId || timestamp (ms) → HMAC-SHA256 avec ADMIN_2FA_ENCRYPTION_KEY.
 * Payload final : base64url(`${userId}.${ts}.${hmacHex}`).
 *
 * Validité : 30 minutes glissantes (pas de refresh — re-prompt 2FA après 30 min).
 *
 * Le cookie ne contient AUCUN secret. Il atteste que ce user_id a validé 2FA
 * à ce timestamp. Si un attaquant vole le cookie, il a 30 min, mais ne peut pas
 * le forger pour un autre user (HMAC binding sur userId).
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

export const TWO_FA_COOKIE_NAME = 'admin_2fa_validated'
export const TWO_FA_COOKIE_TTL_MS = 30 * 60 * 1000 // 30 minutes

function getSigningKey(): string {
  const key = process.env.ADMIN_2FA_ENCRYPTION_KEY
  if (!key) {
    throw new Error('ADMIN_2FA_ENCRYPTION_KEY env var manquante (cookie 2FA).')
  }
  return key
}

/**
 * Signe un cookie 2FA pour `userId`. À poser via cookies().set(...) côté API.
 */
export function signTwoFaCookie(userId: string): string {
  const ts = Date.now()
  const payload = `${userId}.${ts}`
  const hmac = createHmac('sha256', getSigningKey()).update(payload).digest('hex')
  return Buffer.from(`${payload}.${hmac}`, 'utf8').toString('base64url')
}

/**
 * Vérifie que le cookie est valide pour ce userId et non expiré.
 * Renvoie false (jamais throw) pour tout problème de format/signature/expiration.
 */
export function verifyTwoFaCookie(cookieValue: string | undefined, userId: string): boolean {
  if (!cookieValue) return false
  try {
    const decoded = Buffer.from(cookieValue, 'base64url').toString('utf8')
    const parts = decoded.split('.')
    if (parts.length !== 3) return false
    const [cookieUserId, tsStr, providedHmac] = parts

    if (cookieUserId !== userId) return false

    const ts = Number.parseInt(tsStr, 10)
    if (!Number.isFinite(ts)) return false
    if (Date.now() - ts > TWO_FA_COOKIE_TTL_MS) return false

    const expectedHmac = createHmac('sha256', getSigningKey())
      .update(`${cookieUserId}.${tsStr}`)
      .digest('hex')

    const providedBuf = Buffer.from(providedHmac, 'utf8')
    const expectedBuf = Buffer.from(expectedHmac, 'utf8')
    if (providedBuf.length !== expectedBuf.length) return false
    return timingSafeEqual(providedBuf, expectedBuf)
  } catch {
    return false
  }
}
