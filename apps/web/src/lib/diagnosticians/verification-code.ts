/**
 * Génération + validation des codes de vérification 6 chiffres
 * pour le workflow claim (email/SMS).
 *
 * Sécurité :
 * - Code généré via crypto.getRandomValues (pas Math.random)
 * - Toujours 6 chiffres avec padStart (jamais de zéros tronqués)
 * - Expiration 10 min par défaut
 * - 5 tentatives max
 */

const CODE_LENGTH = 6
const DEFAULT_TTL_MS = 10 * 60 * 1000 // 10 minutes
export const MAX_VERIFICATION_ATTEMPTS = 5

/**
 * Génère un code aléatoire 6 chiffres (000000 à 999999).
 * Utilise crypto.getRandomValues pour entropie cryptographique.
 */
export function generateVerificationCode(): string {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  const n = arr[0]! % 1_000_000
  return n.toString().padStart(CODE_LENGTH, '0')
}

/**
 * Retourne la date d'expiration d'un code (par défaut now + 10 min).
 */
export function computeCodeExpiresAt(ttlMs: number = DEFAULT_TTL_MS): Date {
  return new Date(Date.now() + ttlMs)
}

/**
 * Vérifie qu'un code soumis est valide :
 * - format 6 chiffres
 * - correspond au code stocké
 * - non expiré
 * - pas plus de MAX_VERIFICATION_ATTEMPTS tentatives
 */
export type CodeCheckResult =
  | { valid: true }
  | { valid: false; reason: 'invalid_format' | 'expired' | 'too_many_attempts' | 'mismatch' }

export function checkVerificationCode(opts: {
  submitted: string
  stored: string | null
  expiresAt: string | Date | null
  attempts: number
}): CodeCheckResult {
  const { submitted, stored, expiresAt, attempts } = opts

  if (attempts >= MAX_VERIFICATION_ATTEMPTS) {
    return { valid: false, reason: 'too_many_attempts' }
  }

  if (!/^\d{6}$/.test(submitted)) {
    return { valid: false, reason: 'invalid_format' }
  }

  if (!stored || !expiresAt) {
    return { valid: false, reason: 'mismatch' }
  }

  const expiry = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt
  if (expiry.getTime() < Date.now()) {
    return { valid: false, reason: 'expired' }
  }

  // Comparaison constante-time pour éviter timing-attack
  if (!constantTimeEqual(submitted, stored)) {
    return { valid: false, reason: 'mismatch' }
  }

  return { valid: true }
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: i is bounded by a.length
    mismatch |= a.charCodeAt(i)! ^ b.charCodeAt(i)!
  }
  return mismatch === 0
}
