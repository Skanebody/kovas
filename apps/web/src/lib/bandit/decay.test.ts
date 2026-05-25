import { describe, expect, it } from 'vitest'
import { decayBeta, halfLife } from './decay'

describe('decayBeta', () => {
  it('converges towards prior Beta(1, 1) after many applications', () => {
    // Avec γ=0.95, la déviation au prior est multipliée par 0.95 à chaque tick.
    // Après N itérations, deviation_finale = deviation_initiale × 0.95^N.
    // Pour α=50, β=30, dev_init = 49 et 29 respectivement.
    // Pour atteindre tolérance 0.05 (toBeCloseTo(_, 1)), il faut :
    //   49 × 0.95^N ≤ 0.05  →  N ≥ log(0.05/49) / log(0.95) ≈ 134 itérations.
    // On prend 150 pour une marge confortable.
    let { alpha, beta } = { alpha: 50, beta: 30 }
    for (let i = 0; i < 150; i++) {
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
