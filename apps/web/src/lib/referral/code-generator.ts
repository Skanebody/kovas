import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Générateur de codes de parrainage uniques.
 *
 * Format : `KOV-XXXXX` — 5 caractères alphanumériques après le préfixe,
 * alphabet sans ambiguïtés visuelles (0/O/I/1 exclus) pour faciliter
 * la dictée téléphonique et l'écriture manuscrite.
 *
 * Capacité combinatoire : 32^5 = 33 554 432 codes.
 * Probabilité de collision sur 100k utilisateurs : ~0,000003%.
 */

const REFERRAL_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const REFERRAL_CODE_LENGTH = 5
const REFERRAL_CODE_PREFIX = 'KOV-'

/**
 * Génère un code aléatoire au format `KOV-A4F2G`.
 * Utilise Math.random — l'unicité est garantie par la contrainte UNIQUE en DB
 * + le retry de `ensureReferralCode`.
 */
export function generateReferralCode(): string {
  let body = ''
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    body += REFERRAL_CODE_ALPHABET[Math.floor(Math.random() * REFERRAL_CODE_ALPHABET.length)]
  }
  return `${REFERRAL_CODE_PREFIX}${body}`
}

/**
 * Vérifie qu'une chaîne respecte le format `KOV-XXXXX`.
 * Tolérant à la casse + aux espaces (saisie au clavier).
 */
export function isValidReferralCodeFormat(input: string | null | undefined): boolean {
  if (!input) return false
  const cleaned = normalizeReferralCode(input)
  return /^KOV-[A-Z2-9]{5}$/.test(cleaned)
}

/**
 * Normalise une saisie utilisateur :
 * - majuscules
 * - suppression espaces
 * - garantie du préfixe `KOV-`
 */
export function normalizeReferralCode(input: string): string {
  const stripped = input.toUpperCase().replace(/\s+/g, '')
  if (stripped.startsWith('KOV-')) return stripped
  if (stripped.startsWith('KOV')) return `KOV-${stripped.slice(3)}`
  return `KOV-${stripped}`
}

/**
 * Assure qu'un utilisateur dispose d'un code de parrainage.
 *
 * - Si un code existe déjà → retourné en l'état (idempotent).
 * - Sinon → boucle de retry max 5 fois sur collision UNIQUE (extrêmement rare).
 *
 * Server-only. La policy RLS "referral_codes: owner insert"
 * (migration 20260524210000) doit être en place sur la base.
 *
 * Résilient : si l'INSERT échoue pour cause de course condition (un autre
 * onglet a inséré entre-temps), on relit le code existant au lieu de throw.
 */
export async function ensureReferralCode(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  // Lecture préalable (idempotent)
  const { data: existing } = await supabase
    .from('referral_codes')
    .select('code')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing?.code) return existing.code as string

  // Création avec retry sur collision
  let lastError: string | null = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode()
    const { error } = await supabase
      .from('referral_codes')
      .insert({ user_id: userId, code, active: true })

    if (!error) return code

    lastError = error.message
    const msg = error.message.toLowerCase()

    // Race condition : un autre tab a déjà créé le code pour ce user
    // (UNIQUE (user_id) violation). On relit et on retourne.
    if (msg.includes('user_id') || msg.includes('referral_codes_user_id')) {
      const { data: retry } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('user_id', userId)
        .maybeSingle()
      if (retry?.code) return retry.code as string
    }

    // Code 23505 = unique_violation Postgres — soit user_id (cf. ci-dessus),
    // soit code (très rare, on retry avec un nouveau code).
    if (!msg.includes('duplicate') && !error.message.includes('23505')) {
      throw new Error(`Création code parrainage impossible : ${error.message}`)
    }
  }

  throw new Error(`Collisions répétées sur le code parrainage (5 essais) : ${lastError ?? '?'}`)
}
