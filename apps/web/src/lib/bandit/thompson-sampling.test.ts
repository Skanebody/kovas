import { describe, expect, it } from 'vitest'
import {
  expectedBeta,
  partitionWarmEstablished,
  rankArms,
  rankWithColdStart,
  sampleBeta,
  sampleGamma,
} from './thompson-sampling'

/**
 * RNG mulberry32 — seedable, déterministe, distribution uniforme convenable.
 * Utilisé pour tests reproductibles.
 */
function seededRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('sampleGamma', () => {
  it('throws on non-positive shape', () => {
    expect(() => sampleGamma(0)).toThrow()
    expect(() => sampleGamma(-1)).toThrow()
  })

  it('produces values close to mean = shape for shape ≥ 1', () => {
    const rng = seededRng(42)
    const samples = Array.from({ length: 2000 }, () => sampleGamma(5, rng))
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    expect(mean).toBeGreaterThan(4.5)
    expect(mean).toBeLessThan(5.5)
  })

  it('handles shape < 1 via boosted recursion', () => {
    const rng = seededRng(99)
    const samples = Array.from({ length: 500 }, () => sampleGamma(0.5, rng))
    expect(samples.every((s) => s > 0)).toBe(true)
  })
})

describe('sampleBeta', () => {
  it('produces values in [0, 1]', () => {
    const rng = seededRng(7)
    for (let i = 0; i < 500; i++) {
      const s = sampleBeta(2, 5, rng)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(1)
    }
  })

  it('mean matches E[Beta] = α / (α + β) within 0.05', () => {
    const rng = seededRng(31)
    const samples = Array.from({ length: 3000 }, () => sampleBeta(3, 7, rng))
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length
    expect(Math.abs(mean - expectedBeta(3, 7))).toBeLessThan(0.05)
  })

  it('throws on non-positive alpha/beta', () => {
    expect(() => sampleBeta(0, 1)).toThrow()
    expect(() => sampleBeta(1, 0)).toThrow()
  })
})

describe('rankArms', () => {
  it('puts the strong arm first the majority of trials', () => {
    const arms = [
      { armId: 'strong', stats: { alpha: 100, beta: 5 } },
      { armId: 'mid', stats: { alpha: 30, beta: 30 } },
      { armId: 'weak', stats: { alpha: 5, beta: 100 } },
    ]
    let strongFirst = 0
    for (let i = 0; i < 200; i++) {
      const rng = seededRng(i + 1)
      const ranked = rankArms(arms, { rng })
      if (ranked[0]?.armId === 'strong') strongFirst++
    }
    // strong should dominate
    expect(strongFirst).toBeGreaterThan(150)
  })

  it('returns same length as input', () => {
    const arms = [
      { armId: 'a', stats: { alpha: 1, beta: 1 } },
      { armId: 'b', stats: { alpha: 2, beta: 2 } },
    ]
    expect(rankArms(arms).length).toBe(2)
  })
})

describe('partitionWarmEstablished', () => {
  it('splits arms by impression count', () => {
    const arms = [
      { armId: 'new', stats: { alpha: 2, beta: 3 }, impressions: 3 },
      { armId: 'old', stats: { alpha: 50, beta: 50 }, impressions: 98 },
    ]
    const { warm, established } = partitionWarmEstablished(arms, 50)
    expect(warm.map((a) => a.armId)).toEqual(['new'])
    expect(established.map((a) => a.armId)).toEqual(['old'])
  })

  it('infers impressions from stats when omitted', () => {
    const arms = [
      // impressions ≈ alpha + beta - 2 = 0 (cold)
      { armId: 'cold', stats: { alpha: 1, beta: 1 } },
      // impressions ≈ 100
      { armId: 'hot', stats: { alpha: 50, beta: 52 } },
    ]
    const { warm, established } = partitionWarmEstablished(arms, 50)
    expect(warm[0]?.armId).toBe('cold')
    expect(established[0]?.armId).toBe('hot')
  })
})

describe('rankWithColdStart', () => {
  it('injects at least one warm arm in top N', () => {
    const arms = [
      ...Array.from({ length: 10 }, (_, i) => ({
        armId: `est-${i}`,
        stats: { alpha: 80, beta: 20 },
        impressions: 200,
      })),
      { armId: 'newcomer', stats: { alpha: 1, beta: 1 }, impressions: 0 },
    ]
    const rng = seededRng(5)
    const top = rankWithColdStart(arms, { topN: 10, warmSlots: 2, rng })
    expect(top.length).toBe(10)
    expect(top.some((a) => a.armId === 'newcomer')).toBe(true)
  })

  it('falls back to established when no warm arms exist', () => {
    const arms = Array.from({ length: 5 }, (_, i) => ({
      armId: `est-${i}`,
      stats: { alpha: 50, beta: 20 },
      impressions: 100,
    }))
    const top = rankWithColdStart(arms, { topN: 3, warmSlots: 2 })
    expect(top.length).toBe(3)
  })
})
