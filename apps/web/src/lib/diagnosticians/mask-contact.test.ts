import { describe, expect, it } from 'vitest'
import { isFrenchMobile, maskEmail, maskPhone, maskSiret } from './mask-contact'

describe('maskEmail', () => {
  it('masks middle of local + domain, keeps TLD', () => {
    expect(maskEmail('pierre.dupont@cabinet.fr')).toBe('p***********t@c*****t.fr')
  })

  it('handles short local part', () => {
    expect(maskEmail('a@b.fr')).toBe('a*@b*.fr')
  })

  it('returns *** for empty or malformed', () => {
    expect(maskEmail('')).toBe('***')
    expect(maskEmail('not-an-email')).toBe('***')
  })
})

describe('maskPhone', () => {
  it('masks middle digits of FR mobile, keeps last 2', () => {
    const masked = maskPhone('+33612345678')
    expect(masked).toContain('+33')
    expect(masked).toContain('78')
    expect(masked).not.toContain('123456')
  })

  it('handles spaces in input', () => {
    expect(maskPhone('+33 6 12 34 56 78')).toContain('78')
  })
})

describe('maskSiret', () => {
  it('keeps first 3 + last 5, masks middle 6', () => {
    expect(maskSiret('12345678900012')).toBe('123 *** *** 00012')
  })

  it('returns *** for invalid SIRET', () => {
    expect(maskSiret('123')).toBe('***')
    expect(maskSiret('')).toBe('***')
  })
})

describe('isFrenchMobile', () => {
  it('accepts 06/07 with or without +33', () => {
    expect(isFrenchMobile('+33612345678')).toBe(true)
    expect(isFrenchMobile('+33712345678')).toBe(true)
    expect(isFrenchMobile('0612345678')).toBe(true)
    expect(isFrenchMobile('0712345678')).toBe(true)
  })

  it('rejects landline FR (01/02/03/04/05/09)', () => {
    expect(isFrenchMobile('0123456789')).toBe(false)
    expect(isFrenchMobile('+33123456789')).toBe(false)
  })

  it('handles whitespace', () => {
    expect(isFrenchMobile('+33 6 12 34 56 78')).toBe(true)
  })
})
