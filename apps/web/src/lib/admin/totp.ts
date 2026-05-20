/**
 * TOTP RFC 6238 maison — pas de dépendance externe (otplib reporté itération 2+).
 *
 * Implémente :
 *   - Base32 encode/decode (RFC 4648, alphabet sans I/L/O/0/1)
 *   - HOTP via HMAC-SHA1 (RFC 4226 §5.3) tronqué dynamiquement
 *   - TOTP step 30s, fenêtre de tolérance configurable
 *   - otpauth:// URL pour QR Authenticator (Google Authenticator / Authy / 1Password)
 *
 * Sécurité :
 *   - generateSecret() = 160 bits randomBytes (recommandation RFC 4226 §4)
 *   - timing-safe : verifyTotp parcourt toutes les fenêtres avant return (pas de short-circuit)
 *   - Le secret n'est JAMAIS loggé. Stocké chiffré (cf. totp-crypto.ts).
 */

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const STEP_SECONDS = 30
const DIGITS = 6

/**
 * Génère un secret TOTP base32 de 160 bits (32 caractères base32).
 */
export function generateSecret(): string {
  const bytes = randomBytes(20)
  return base32Encode(bytes)
}

/**
 * Génère le code TOTP à 6 chiffres pour un instant donné (ms epoch).
 * timestamp par défaut = Date.now()
 */
export function generateTotp(secret: string, timestamp?: number): string {
  const time = Math.floor((timestamp ?? Date.now()) / 1000 / STEP_SECONDS)
  const buffer = Buffer.alloc(8)
  buffer.writeBigInt64BE(BigInt(time), 0)

  const key = base32Decode(secret)
  const hmac = createHmac('sha1', key).update(buffer).digest()

  const offset = hmac[hmac.length - 1] & 0x0f
  const code =
    (((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff)) %
    10 ** DIGITS

  return code.toString().padStart(DIGITS, '0')
}

/**
 * Vérifie un token TOTP avec tolérance de fenêtre (par défaut +/- 1 step = +/- 30s).
 * Comparaison timing-safe pour éviter une attaque temporelle révélant la fenêtre.
 */
export function verifyTotp(secret: string, token: string, window = 1): boolean {
  if (!/^\d{6}$/.test(token)) return false
  const now = Date.now()
  const tokenBuf = Buffer.from(token, 'utf8')

  let matched = false
  for (let i = -window; i <= window; i++) {
    const candidate = generateTotp(secret, now + i * STEP_SECONDS * 1000)
    const candidateBuf = Buffer.from(candidate, 'utf8')
    // timingSafeEqual exige des buffers de même taille — toujours 6 chars ici.
    if (timingSafeEqual(tokenBuf, candidateBuf)) {
      matched = true
      // NE PAS break : on parcourt toute la fenêtre pour rester time-constant
    }
  }
  return matched
}

/**
 * Construit l'URL otpauth:// utilisée par les apps Authenticator pour scanner
 * un QR code. Format : otpauth://totp/<issuer>:<account>?secret=...&issuer=...
 */
export function buildOtpauthUrl(
  secret: string,
  accountName: string,
  issuer = 'KOVAS Admin',
): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  })
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}`
  return `otpauth://totp/${label}?${params.toString()}`
}

// ============================================
// Base32 helpers (RFC 4648 sans padding)
// ============================================

function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f]
  }
  return output
}

function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/, '').toUpperCase().replace(/\s/g, '')
  let bits = 0
  let value = 0
  const output: number[] = []
  for (let i = 0; i < cleaned.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleaned[i])
    if (idx === -1) {
      throw new Error(`Invalid base32 character: ${cleaned[i]}`)
    }
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(output)
}
