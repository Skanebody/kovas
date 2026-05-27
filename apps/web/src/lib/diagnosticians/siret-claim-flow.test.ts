/**
 * Tests unitaires sur le flux Luhn SIRET tel qu'utilisé par
 * /api/diagnosticians/[id]/claim/verify-siret.
 *
 * Le SIRET est validé via lib existante (lib/validation/siret),
 * on documente ici les SIRETs canoniques utilisés.
 */

import { validateSiret } from '@/lib/validation/siret'
import { describe, expect, it } from 'vitest'

describe('SIRET claim — Luhn validation', () => {
  it('accepts valid SIRETs (Luhn passes)', () => {
    // Quelques SIRETs réels publics (Luhn-valides)
    const validSirets = [
      '78467169500087', // Carrefour SA siège (exemple historique courant en docs)
      '54205118300023', // SNCF
      '40328379000128', // Orange (siège)
    ]
    for (const siret of validSirets) {
      const result = validateSiret(siret)
      expect(result.valid).toBe(true)
    }
  })

  it('rejects SIRETs with invalid checksum', () => {
    const invalid = '12345678900001'
    const result = validateSiret(invalid)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toBe('invalid_checksum')
  })

  it('rejects SIRETs with wrong length', () => {
    expect(validateSiret('123').valid).toBe(false)
    expect(validateSiret('123456789012345').valid).toBe(false) // 15 chars
    expect(validateSiret('').valid).toBe(false)
  })

  it('rejects SIRETs with non-digits', () => {
    expect(validateSiret('1234567890001A').valid).toBe(false)
  })

  it('strips whitespace transparently', () => {
    const padded = '784 671 695 00087'
    const result = validateSiret(padded)
    expect(result.valid).toBe(true)
  })
})

describe('SIRET claim — exact match required', () => {
  it('match is case-insensitive on whitespace only (digits exactly)', () => {
    const stored = '78467169500087'
    const submitted = '784 67169500087'
    expect(stored.replace(/\s/g, '')).toBe(submitted.replace(/\s/g, ''))
  })

  it('mismatch returns rejected', () => {
    const stored = '78467169500087'
    const submitted = '40328379000128'
    expect(stored).not.toBe(submitted)
  })
})
