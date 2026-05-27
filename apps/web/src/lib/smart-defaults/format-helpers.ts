/**
 * Helpers de formatage live des inputs métier (SIRET, téléphone, code postal).
 */

import { type CountryCode, isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js'

/**
 * Formate un SIRET en groupe lisible « 123 456 789 00012 ».
 * Tolère et conserve le contenu partiel pour la saisie progressive.
 */
export function formatSiretLive(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 14)
  const parts: string[] = []
  if (digits.length > 0) parts.push(digits.slice(0, 3))
  if (digits.length > 3) parts.push(digits.slice(3, 6))
  if (digits.length > 6) parts.push(digits.slice(6, 9))
  if (digits.length > 9) parts.push(digits.slice(9, 14))
  return parts.join(' ')
}

/**
 * Formate un téléphone FR au format national lisible « 06 12 34 56 78 ».
 * Renvoie l'entrée non touchée si elle n'est pas parsable.
 */
export function formatPhoneLive(raw: string, country: CountryCode = 'FR'): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  try {
    const parsed = parsePhoneNumber(trimmed, country)
    if (!parsed) return raw
    // Format national si pays défaut, sinon international
    if (parsed.country === country) {
      return parsed.formatNational()
    }
    return parsed.formatInternational()
  } catch {
    return raw
  }
}

/**
 * Convertit un téléphone en E.164 pour stockage. Renvoie null si non valide.
 */
export function toE164(raw: string, country: CountryCode = 'FR'): string | null {
  try {
    if (!isValidPhoneNumber(raw, country)) return null
    const parsed = parsePhoneNumber(raw, country)
    return parsed?.number ?? null
  } catch {
    return null
  }
}

/**
 * Vérifie format code postal FR (5 chiffres). Pour exhaustivité métier on accepte
 * les départements 01-95, 971-976 (DOM-COM) et Monaco 980xx.
 */
export function isValidFrenchPostalCode(raw: string): boolean {
  const cleaned = raw.replace(/\s/g, '')
  if (!/^\d{5}$/.test(cleaned)) return false
  const dept = Number.parseInt(cleaned.slice(0, 2), 10)
  if (cleaned.startsWith('97') || cleaned.startsWith('98')) return true
  return dept >= 1 && dept <= 95
}
