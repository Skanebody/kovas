/**
 * Tests unitaires — generateVerificationCode + checkVerificationCode + mask helpers.
 *
 * Convention : ces tests sont écrits en Vitest-style mais le repo n'a pas
 * encore de framework de test installé. Ils servent de spec exécutable
 * dès que vitest sera ajouté (sprint 14 du planning MVP).
 */

import { describe, expect, it } from 'vitest'
import {
  checkVerificationCode,
  computeCodeExpiresAt,
  generateVerificationCode,
  MAX_VERIFICATION_ATTEMPTS,
} from './verification-code'

describe('generateVerificationCode', () => {
  it('returns a 6-digit string', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateVerificationCode()
      expect(code).toMatch(/^\d{6}$/)
      expect(code.length).toBe(6)
    }
  })

  it('preserves leading zeros (000000 to 999999 valid)', () => {
    // Forcer crypto à retourner 0 → on doit obtenir "000000"
    const orig = crypto.getRandomValues
    // biome-ignore lint/suspicious/noExplicitAny: test-only spy
    ;(crypto as any).getRandomValues = (arr: Uint32Array) => {
      arr[0] = 0
      return arr
    }
    expect(generateVerificationCode()).toBe('000000')
    ;(crypto as any).getRandomValues = orig
  })

  it('produces variety (not deterministic in normal use)', () => {
    const set = new Set<string>()
    for (let i = 0; i < 100; i++) set.add(generateVerificationCode())
    expect(set.size).toBeGreaterThan(50)
  })
})

describe('computeCodeExpiresAt', () => {
  it('returns ~10 min in future by default', () => {
    const now = Date.now()
    const expiry = computeCodeExpiresAt()
    const diff = expiry.getTime() - now
    expect(diff).toBeGreaterThan(9 * 60 * 1000)
    expect(diff).toBeLessThan(11 * 60 * 1000)
  })

  it('respects custom TTL', () => {
    const expiry = computeCodeExpiresAt(60_000)
    expect(expiry.getTime()).toBeGreaterThan(Date.now() + 50_000)
    expect(expiry.getTime()).toBeLessThan(Date.now() + 70_000)
  })
})

describe('checkVerificationCode', () => {
  const validCode = '384729'
  const future = new Date(Date.now() + 10 * 60_000)
  const past = new Date(Date.now() - 10_000)

  it('accepts correct code within TTL and attempt budget', () => {
    expect(
      checkVerificationCode({
        submitted: validCode,
        stored: validCode,
        expiresAt: future,
        attempts: 0,
      }),
    ).toEqual({ valid: true })
  })

  it('rejects malformed code', () => {
    expect(
      checkVerificationCode({
        submitted: '12345',
        stored: validCode,
        expiresAt: future,
        attempts: 0,
      }),
    ).toEqual({ valid: false, reason: 'invalid_format' })

    expect(
      checkVerificationCode({
        submitted: 'abcdef',
        stored: validCode,
        expiresAt: future,
        attempts: 0,
      }),
    ).toEqual({ valid: false, reason: 'invalid_format' })
  })

  it('rejects mismatching code', () => {
    expect(
      checkVerificationCode({
        submitted: '111111',
        stored: validCode,
        expiresAt: future,
        attempts: 0,
      }),
    ).toEqual({ valid: false, reason: 'mismatch' })
  })

  it('rejects expired code', () => {
    expect(
      checkVerificationCode({
        submitted: validCode,
        stored: validCode,
        expiresAt: past,
        attempts: 0,
      }),
    ).toEqual({ valid: false, reason: 'expired' })
  })

  it('rejects when attempts exceeded', () => {
    expect(
      checkVerificationCode({
        submitted: validCode,
        stored: validCode,
        expiresAt: future,
        attempts: MAX_VERIFICATION_ATTEMPTS,
      }),
    ).toEqual({ valid: false, reason: 'too_many_attempts' })
  })

  it('rejects when stored is null', () => {
    expect(
      checkVerificationCode({
        submitted: validCode,
        stored: null,
        expiresAt: future,
        attempts: 0,
      }),
    ).toEqual({ valid: false, reason: 'mismatch' })
  })
})
