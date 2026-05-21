/**
 * Validation helpers pour le form B2C QuoteRequest (client-side).
 * Server-side validation : zod schema dans route handler.
 */

import { isValidPhoneNumber, parsePhoneNumberFromString } from 'libphonenumber-js'

/**
 * Domaines emails personnels — KOVAS B2C accepte tout (différent de l'app diag où on filtre pro).
 * Cette liste sert uniquement à un check soft "Êtes-vous sûr ?" plus tard si besoin.
 */
const SOFT_PERSONAL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.fr',
  'yahoo.com',
  'hotmail.fr',
  'hotmail.com',
  'outlook.fr',
  'outlook.com',
  'orange.fr',
  'free.fr',
  'sfr.fr',
  'laposte.net',
  'wanadoo.fr',
  'icloud.com',
  'me.com',
])

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export type EmailValidationResult =
  | { kind: 'idle' }
  | { kind: 'invalid'; message: string }
  | { kind: 'valid'; isPersonal: boolean }

export function validateEmailSyntax(email: string): EmailValidationResult {
  const trimmed = email.trim()
  if (!trimmed) return { kind: 'idle' }
  if (!EMAIL_REGEX.test(trimmed)) {
    return { kind: 'invalid', message: 'Format d’email invalide' }
  }
  const domain = trimmed.split('@')[1]?.toLowerCase() ?? ''
  return { kind: 'valid', isPersonal: SOFT_PERSONAL_DOMAINS.has(domain) }
}

export type PhoneValidationResult =
  | { kind: 'idle' }
  | { kind: 'invalid'; message: string }
  | { kind: 'valid'; e164: string; formatted: string }

export function validatePhone(input: string): PhoneValidationResult {
  const trimmed = input.trim()
  if (!trimmed) return { kind: 'idle' }
  try {
    const parsed = parsePhoneNumberFromString(trimmed, 'FR')
    if (!parsed || !isValidPhoneNumber(trimmed, 'FR')) {
      return { kind: 'invalid', message: 'Numéro de téléphone invalide' }
    }
    return {
      kind: 'valid',
      e164: parsed.number,
      formatted: parsed.formatNational(),
    }
  } catch {
    return { kind: 'invalid', message: 'Numéro de téléphone invalide' }
  }
}

export type NumberValidationResult =
  | { kind: 'idle' }
  | { kind: 'invalid'; message: string }
  | { kind: 'valid'; value: number }

export function validateSurface(input: string): NumberValidationResult {
  const trimmed = input.trim()
  if (!trimmed) return { kind: 'idle' }
  const num = Number(trimmed)
  if (!Number.isFinite(num)) return { kind: 'invalid', message: 'Surface invalide' }
  if (num <= 0) return { kind: 'invalid', message: 'Surface doit être positive' }
  if (num >= 10000) return { kind: 'invalid', message: 'Surface trop grande (max 10000 m²)' }
  return { kind: 'valid', value: Math.round(num) }
}

export function validateYearBuilt(input: string): NumberValidationResult {
  const trimmed = input.trim()
  if (!trimmed) return { kind: 'idle' }
  const num = Number(trimmed)
  if (!Number.isInteger(num)) return { kind: 'invalid', message: 'Année invalide' }
  if (num <= 1800) return { kind: 'invalid', message: 'Année doit être > 1800' }
  if (num > 2026) return { kind: 'invalid', message: 'Année doit être ≤ 2026' }
  return { kind: 'valid', value: num }
}
