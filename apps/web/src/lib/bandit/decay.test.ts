import { describe, expect, it } from 'vitest'
import { decayBeta, halfLife } from './decay'

describe('decayBeta', () => {
  it('converges towards prior Beta(1, 1) after many applications', () => {
    let { alpha, beta } = { alpha: 50, beta: 30 }
    for (let i = 0; i < 100; i++) {
      ;({ alpha, beta } = decayBeta(alpha, beta, 0.95))
    }
    expect(alpha).toBeCloseTo(1, 1)
    expect(beta).toBeCloseTo(1, 1)
  })

  it('does not decay below prior', () => {
    const { alpha, beta } = decayBeta(1, 1, 0.5)
    expect(alpha).toBe(1)
    expect(beta).toBe(1)
  })

  it('preserves single-step formula', () => {
    const { alpha, beta } = decayBeta(11, 21, 0.5)
    // 1 + (11 - 1) * 0.5 = 6 ; 1 + (21 - 1) * 0.5 = 11
    expect(alpha).toBe(6)
    expect(beta).toBe(11)
  })

  it('throws on invalid factor', () => {
    expect(() => decayBeta(2, 2, 0)).toThrow()
    expect(() => decayBeta(2, 2, 1.1)).toThrow()
    expect(() => decayBeta(2, 2, -0.5)).toThrow()
  })
})

describe('halfLife', () => {
  it('returns ~13.5 for γ = 0.95', () => {
    expect(halfLife(0.95)).toBeCloseTo(13.51, 1)
  })

  it('returns Infinity for γ = 1', () => {
    expect(halfLife(1)).toBe(Number.POSITIVE_INFINITY)
  })
})
