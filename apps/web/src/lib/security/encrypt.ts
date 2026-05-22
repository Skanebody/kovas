/**
 * Helper de chiffrement symétrique AES-256-GCM pour tokens d'API tiers
 * (Qonto, Pennylane, Indy, Tiime, etc.) stockés dans la base.
 *
 * Format ciphertext sortie : "v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>"
 * Le préfixe "v1:" permet une rotation future (v2 GCM-SIV, etc.).
 *
 * Clé : variable d'env `ENCRYPTION_KEY` (32 bytes hex = 64 chars hex).
 * Génération : `openssl rand -hex 32`.
 *
 * En dev sans clé : fallback base64 + warning console. NE JAMAIS utiliser en prod.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  type CipherGCM,
  type DecipherGCM,
} from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12 // 96 bits — recommandation NIST pour GCM
const KEY_BYTES = 32 // 256 bits
const VERSION = 'v1'

let warnedNoKey = false

function loadKey(): Buffer | null {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) return null

  if (!/^[0-9a-fA-F]+$/.test(raw)) {
    throw new Error(
      '[encrypt] ENCRYPTION_KEY doit être en hexadécimal (généré via `openssl rand -hex 32`).',
    )
  }
  const buf = Buffer.from(raw, 'hex')
  if (buf.length !== KEY_BYTES) {
    throw new Error(
      `[encrypt] ENCRYPTION_KEY doit faire ${KEY_BYTES} bytes (${KEY_BYTES * 2} chars hex). Reçu ${buf.length} bytes.`,
    )
  }
  return buf
}

function fallbackWarn(): void {
  if (warnedNoKey) return
  warnedNoKey = true
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[encrypt] ENCRYPTION_KEY manquante en production. Génère via `openssl rand -hex 32` et configure Vercel.',
    )
  }
  // eslint-disable-next-line no-console
  console.warn(
    '[encrypt] ENCRYPTION_KEY absente — fallback base64 (DEV UNIQUEMENT, JAMAIS en production).',
  )
}

/**
 * Chiffre un secret texte en clair (login:secret_key Qonto, token Pennylane, etc.).
 * Retourne une chaîne stockable telle-quelle en base.
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) throw new Error('[encrypt] Plaintext vide.')

  const key = loadKey()
  if (!key) {
    fallbackWarn()
    return `dev:${Buffer.from(plaintext, 'utf8').toString('base64')}`
  }

  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv) as CipherGCM
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [VERSION, iv.toString('hex'), tag.toString('hex'), enc.toString('hex')].join(':')
}

/**
 * Déchiffre un ciphertext stocké (format `v1:iv:tag:data` ou `dev:base64`).
 * Throw si format invalide ou auth tag corrompu.
 */
export function decryptToken(ciphertext: string): string {
  if (!ciphertext) throw new Error('[encrypt] Ciphertext vide.')

  if (ciphertext.startsWith('dev:')) {
    fallbackWarn()
    return Buffer.from(ciphertext.slice(4), 'base64').toString('utf8')
  }

  const parts = ciphertext.split(':')
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('[encrypt] Format ciphertext invalide (attendu v1:iv:tag:data).')
  }
  const [, ivHex, tagHex, dataHex] = parts as [string, string, string, string]

  const key = loadKey()
  if (!key) {
    throw new Error(
      '[encrypt] Impossible de déchiffrer : ENCRYPTION_KEY absente alors que ciphertext est v1.',
    )
  }

  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')

  const decipher = createDecipheriv(ALGO, key, iv) as DecipherGCM
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(data), decipher.final()])
  return dec.toString('utf8')
}

/**
 * Helper pour masquer un token à l'affichage (UI settings).
 * `qonto_login_xxxx:secret_yyyyyyyy` → `qonto_login_xxxx:secret_*****yy`
 */
/**
 * Alias : `decryptSecret` / `encryptSecret` / `maskSecret` — convention Pennylane.
 * Conserve `encryptToken` / `decryptToken` / `maskToken` pour Qonto.
 */
export const encryptSecret = encryptToken
export const decryptSecret = decryptToken
export function maskSecret(plaintext: string): string {
  return maskToken(plaintext)
}

export function maskToken(plaintext: string): string {
  if (!plaintext || plaintext.length < 8) return '••••••••'
  return `${plaintext.slice(0, 4)}${'•'.repeat(Math.max(8, plaintext.length - 6))}${plaintext.slice(-2)}`
}
