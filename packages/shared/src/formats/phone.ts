import {
  formatIncompletePhoneNumber,
  isValidPhoneNumber,
  parsePhoneNumberWithError,
} from 'libphonenumber-js'

/**
 * Convention D310 (DISCOVERY.md) — Stockage téléphone :
 * - Storage : E.164 (ex: "+33745025642")
 * - Display : format français lisible ("+33 7 45 02 56 42")
 * - Validation via libphonenumber-js
 */

/**
 * Parse un numéro de téléphone en E.164.
 * @example parsePhoneE164("07 45 02 56 42", "FR") → "+33745025642"
 */
export function parsePhoneE164(input: string, defaultCountry: 'FR' = 'FR'): string {
  const phone = parsePhoneNumberWithError(input, defaultCountry)
  return phone.format('E.164')
}

/**
 * Format un E.164 vers display FR.
 * @example formatPhoneFR("+33745025642") → "+33 7 45 02 56 42"
 */
export function formatPhoneFR(e164: string): string {
  const phone = parsePhoneNumberWithError(e164)
  return phone.formatInternational()
}

/**
 * Valide qu'un numéro est correct (E.164 ou local FR).
 */
export function isValidPhone(input: string, defaultCountry: 'FR' = 'FR'): boolean {
  return isValidPhoneNumber(input, defaultCountry)
}

/**
 * Format incomplet pour input live (UX saisie).
 */
export function formatPhoneIncomplete(input: string, defaultCountry: 'FR' = 'FR'): string {
  return formatIncompletePhoneNumber(input, defaultCountry)
}
