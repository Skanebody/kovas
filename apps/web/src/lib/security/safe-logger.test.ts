/**
 * Tests safeLog + scrubPiiString.
 *
 * Couvre :
 *   - Emails scrubbés en prod, pas en dev
 *   - Téléphone FR (+33 + 0X) scrubbés
 *   - SIRET 14 digits scrubbé
 *   - JWT eyJ.* scrubbé
 *   - Clés Stripe/Supabase/Anthropic/OpenAI scrubbées
 *   - Objects sérialisés et scrubbés (récursif via JSON)
 *   - Multiples patterns dans une même string
 *   - scrubPiiString helper standalone (bypass NODE_ENV)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { safeLog, scrubPiiString } from './safe-logger'

describe('safeLog (prod scrubbing)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let warnSpy: ReturnType<typeof vi.spyOn>
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production')
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    logSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  it('scrubs email addresses', () => {
    safeLog.log('User logged in:', 'benjamin.bel@kovas.fr')
    expect(logSpy).toHaveBeenCalledWith('User logged in:', '[EMAIL]')
  })

  it('scrubs +33 phone numbers', () => {
    safeLog.warn('Calling user:', '+33612345678')
    expect(warnSpy).toHaveBeenCalledWith('Calling user:', '[PHONE_FR]')
  })

  it('scrubs 0X phone numbers (FR format with spaces/dots)', () => {
    safeLog.log('Call: 06 12 34 56 78')
    expect(logSpy).toHaveBeenCalledWith('Call: [PHONE_FR]')
  })

  it('scrubs SIRET (14 digits)', () => {
    safeLog.log('Org SIRET: 12345678901234')
    expect(logSpy).toHaveBeenCalledWith('Org SIRET: [SIRET]')
  })

  it('scrubs JWT tokens', () => {
    const fakeJwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    safeLog.error('Auth header:', fakeJwt)
    expect(errorSpy).toHaveBeenCalledWith('Auth header:', '[JWT]')
  })

  it('scrubs Stripe keys (live + test)', () => {
    safeLog.log('Stripe secret: sk_live_abc123XYZ')
    expect(logSpy).toHaveBeenCalledWith('Stripe secret: [STRIPE_KEY]')

    safeLog.log('Webhook: whsec_test_deadbeef99')
    expect(logSpy).toHaveBeenCalledWith('Webhook: [STRIPE_KEY]')
  })

  it('scrubs Supabase keys (sbp + sb_secret)', () => {
    safeLog.log('Key: sbp_abc123def456ghi789')
    expect(logSpy).toHaveBeenCalledWith('Key: [SUPABASE_KEY]')

    safeLog.log('Service: sb_secret_xyz_789')
    expect(logSpy).toHaveBeenCalledWith('Service: [SUPABASE_KEY]')
  })

  it('scrubs Anthropic API keys', () => {
    safeLog.log('Anthropic: sk-ant-api03-abcDEF123_xyz')
    expect(logSpy).toHaveBeenCalledWith('Anthropic: [ANTHROPIC_KEY]')
  })

  it('scrubs OpenAI API keys (legacy + proj)', () => {
    safeLog.log('OpenAI: sk-proj-abc123XYZ_456')
    expect(logSpy).toHaveBeenCalledWith('OpenAI: [OPENAI_KEY]')
  })

  it('scrubs PII inside objects recursively', () => {
    safeLog.log({
      user: {
        email: 'test@kovas.fr',
        phone: '+33612345678',
      },
      siret: '12345678901234',
    })
    const callArg = logSpy.mock.calls[0]?.[0] as {
      user: { email: string; phone: string }
      siret: string
    }
    expect(callArg.user.email).toBe('[EMAIL]')
    expect(callArg.user.phone).toBe('[PHONE_FR]')
    expect(callArg.siret).toBe('[SIRET]')
  })

  it('scrubs multiple patterns in same string', () => {
    safeLog.log('user@kovas.fr called +33612345678 with SIRET 12345678901234')
    expect(logSpy).toHaveBeenCalledWith('[EMAIL] called [PHONE_FR] with SIRET [SIRET]')
  })

  it('preserves non-PII strings as-is', () => {
    safeLog.log('Mission terminée OK')
    expect(logSpy).toHaveBeenCalledWith('Mission terminée OK')
  })

  it('preserves numbers and booleans unchanged', () => {
    safeLog.log('Count:', 42, true)
    expect(logSpy).toHaveBeenCalledWith('Count:', 42, true)
  })
})

describe('safeLog (dev bypass)', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    logSpy.mockRestore()
  })

  it('does NOT scrub PII in development', () => {
    safeLog.log('Email:', 'benjamin@kovas.fr')
    expect(logSpy).toHaveBeenCalledWith('Email:', 'benjamin@kovas.fr')
  })
})

describe('scrubPiiString (helper standalone)', () => {
  it('scrubs regardless of NODE_ENV', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(scrubPiiString('email: foo@bar.com')).toBe('email: [EMAIL]')
    vi.unstubAllEnvs()
  })

  it('handles empty string', () => {
    expect(scrubPiiString('')).toBe('')
  })

  it('chains multiple patterns', () => {
    const input = 'sk-ant-abc123 et eyJhbc.def.ghi456 pour user@kovas.fr'
    const result = scrubPiiString(input)
    expect(result).toContain('[ANTHROPIC_KEY]')
    expect(result).toContain('[JWT]')
    expect(result).toContain('[EMAIL]')
  })
})
