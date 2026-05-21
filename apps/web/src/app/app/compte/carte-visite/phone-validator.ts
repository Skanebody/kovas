/**
 * Helper isolé — validation E.164 via libphonenumber-js (déjà installé).
 * Importé par actions.ts (server) ; séparé pour rester côté server uniquement.
 */

import { parsePhoneNumberFromString } from 'libphonenumber-js'

export function libphonenumberSafeParse(v: string): boolean {
  try {
    const parsed = parsePhoneNumberFromString(v, 'FR')
    return Boolean(parsed?.isValid())
  } catch {
    return false
  }
}
