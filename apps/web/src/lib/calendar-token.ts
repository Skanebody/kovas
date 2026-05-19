/**
 * Tokens d'abonnement calendrier (subscription URL .ics).
 *
 * Permet à l'utilisateur d'abonner son agenda externe (Google, Apple, Outlook)
 * au calendrier KOVAS via une URL https://kovas.fr/api/calendar/[orgId]/[token].ics
 *
 * Le token est dérivé déterministe par HMAC à partir de l'orgId + un secret
 * serveur — pas besoin de table DB. Pour révoquer/régénérer, on change la
 * version (v=1 → v=2) dans le namespace du HMAC.
 *
 * Sécurité :
 *  - timing-safe compare pour éviter timing attacks
 *  - validation longueur stricte
 *  - le token est porteur (any-one-with-link) — c'est OK car le contenu
 *    exposé est limité au calendrier propre de l'utilisateur, comme un lien
 *    Google Calendar "secret"
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

const TOKEN_LENGTH = 32 // base64url chars
const NAMESPACE_V1 = 'kovas-calendar-v1'

function getServerSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY required for calendar token derivation')
  }
  return secret
}

/**
 * Dérive un token déterministe pour un orgId donné.
 * Même orgId → même token tant que NAMESPACE_V1 et le secret ne changent pas.
 */
export function deriveCalendarToken(orgId: string): string {
  const hmac = createHmac('sha256', getServerSecret())
  hmac.update(`${NAMESPACE_V1}:${orgId}`)
  return hmac
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
    .slice(0, TOKEN_LENGTH)
}

/**
 * Valide un token pour un orgId — timing-safe.
 */
export function validateCalendarToken(orgId: string, token: string): boolean {
  if (typeof token !== 'string' || token.length !== TOKEN_LENGTH) return false
  const expected = deriveCalendarToken(orgId)
  // Buffer.from() + timingSafeEqual nécessite des buffers de même taille
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(token, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * URL d'abonnement complète à exposer à l'utilisateur.
 */
export function buildCalendarSubscriptionUrl(orgId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://kovas.fr'
  const token = deriveCalendarToken(orgId)
  return `${baseUrl}/api/calendar/${orgId}/${token}.ics`
}

/**
 * URL webcal:// — protocole standard d'abonnement calendrier supporté par
 * Apple Calendar et Outlook (open-in-app au lieu de download).
 * Google Calendar utilise la même URL en https://.
 */
export function buildCalendarWebcalUrl(orgId: string): string {
  return buildCalendarSubscriptionUrl(orgId).replace(/^https?:\/\//, 'webcal://')
}
