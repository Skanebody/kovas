/**
 * Chiffrement AES-256-GCM des secrets TOTP en BDD.
 *
 * Format stocké en base64 :
 *   nonce (12 bytes) || ciphertext (variable) || authtag (16 bytes)
 *
 * Clef : ADMIN_2FA_ENCRYPTION_KEY (env), hex 32 bytes (64 chars hex).
 * Génération initiale d'une clef :
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Sécurité :
 *   - GCM = authenticated encryption (intégrité + confidentialité)
 *   - Nonce aléatoire 96 bits par chiffrement (jamais réutilisé)
 *   - Authtag vérifié automatiquement par node:crypto à la déchiffrement
 *     (throws si tampering)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const NONCE_BYTES = 12
const AUTHTAG_BYTES = 16
const KEY_BYTES = 32

function getKey(): Buffer {
  const hex = process.env.ADMIN_2FA_ENCRYPTION_KEY
  if (!hex) {
    throw new Error(
      'ADMIN_2FA_ENCRYPTION_KEY env var manquante. ' +
        "Générer avec : node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    )
  }
  const key = Buffer.from(hex, 'hex')
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `ADMIN_2FA_ENCRYPTION_KEY invalide : ${key.length} bytes (attendu ${KEY_BYTES}).`,
    )
  }
  return key
}

/**
 * Chiffre une chaîne (secret base32 TOTP) → base64 (nonce || ciphertext || authtag).
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey()
  const nonce = randomBytes(NONCE_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, nonce)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authtag = cipher.getAuthTag()
  return Buffer.concat([nonce, ciphertext, authtag]).toString('base64')
}

/**
 * Déchiffre une chaîne base64 (nonce || ciphertext || authtag) → texte.
 * Throws si tampering (authtag mismatch) ou format invalide.
 */
export function decryptSecret(encrypted: string): string {
  const key = getKey()
  const buffer = Buffer.from(encrypted, 'base64')
  if (buffer.length < NONCE_BYTES + AUTHTAG_BYTES) {
    throw new Error('Ciphertext trop court (corruption ou format invalide).')
  }
  const nonce = buffer.subarray(0, NONCE_BYTES)
  const authtag = buffer.subarray(buffer.length - AUTHTAG_BYTES)
  const ciphertext = buffer.subarray(NONCE_BYTES, buffer.length - AUTHTAG_BYTES)

  const decipher = createDecipheriv(ALGORITHM, key, nonce)
  decipher.setAuthTag(authtag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString('utf8')
}
