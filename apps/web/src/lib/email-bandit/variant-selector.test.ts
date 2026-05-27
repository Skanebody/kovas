import { describe, expect, it } from 'vitest'
import {
  type BanditVariant,
  computeWinProbability,
  selectVariant,
  shouldConcludeBandit,
} from './variant-selector'

/**
 * Mulberry32 — PRNG déterministe pour tests reproductibles.
 * Reférence : https://stackoverflow.com/a/47593316
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('selectVariant — cold start', () => {
  it("tous variants trials=0 → reason='cold_start' + premier sélectionné", () => {
    const variants: BanditVariant[] = [
      { id: 'v1', content: 'Subject 1', successes: 0, trials: 0 },
      { id: 'v2', content: 'Subject 2', successes: 0, trials: 0 },
      { id: 'v3', content: 'Subject 3', successes: 0, trials: 0 },
    ]
    const result = selectVariant(variants, mulberry32(42))
    expect(result.reason).toBe('cold_start')
    expect(result.selected_id).toBe('v1')
    expect(result.selected_content).toBe('Subject 1')
  })

  it('un seul variant cold → cold_start, lui-même sélectionné', () => {
    const variants: BanditVariant[] = [
      { id: 'unique', content: 'Only one', successes: 0, trials: 0 },
    ]
    const result = selectVariant(variants, mulberry32(1))
    expect(result.reason).toBe('cold_start')
    expect(result.selected_id).toBe('unique')
  })

  it('variants vides → throw', () => {
    expect(() => selectVariant([], mulberry32(0))).toThrow()
  })
})

describe('selectVariant — déterminisme avec random_fn injecté', () => {
  it('deux appels avec le même PRNG retournent le même résultat', () => {
    const variants: BanditVariant[] = [
      { id: 'v1', content: 'A', successes: 200, trials: 500 },
      { id: 'v2', content: 'B', successes: 150, trials: 500 },
      { id: 'v3', content: 'C', successes: 100, trials: 500 },
    ]
    const r1 = selectVariant(variants, mulberry32(123))
    const r2 = selectVariant(variants, mulberry32(123))
    expect(r1.selected_id).toBe(r2.selected_id)
    expect(r1.sample_value).toBeCloseTo(r2.sample_value, 5)
  })

  it('favorise le meilleur sur de nombreux tirages', () => {
    const variants: BanditVariant[] = [
      { id: 'great', content: 'A', successes: 400, trials: 500 },
      { id: 'mid', content: 'B', successes: 200, trials: 500 },
      { id: 'bad', content: 'C', successes: 50, trials: 500 },
    ]
    const counts: Record<string, number> = { great: 0, mid: 0, bad: 0 }
    const rng = mulberry32(7)
    for (let i = 0; i < 500; i++) {
      const r = selectVariant(variants, rng)
      counts[r.selected_id] = (counts[r.selected_id] ?? 0) + 1
    }
    // Le best doit être sélectionné largement plus souvent que le pire
    expect(counts.great).toBeGreaterThan(counts.bad)
    expect((counts.great ?? 0) > (counts.mid ?? 0)).toBe(true)
  })
})

describe('selectVariant — exploration vs exploitation', () => {
  it("marque 'exploitation' quand un variant domine + trials >= 100", () => {
    const variants: BanditVariant[] = [
      { id: 'dominant', content: 'A', successes: 1000, trials: 1000 },
      { id: 'weak', content: 'B', successes: 0, trials: 1000 },
    ]
    // Avec un dominant qui converge à ~1.0 et un weak à ~0.001, le gap est immense.
    const result = selectVariant(variants, mulberry32(99))
    expect(result.reason).toBe('exploitation')
    expect(result.selected_id).toBe('dominant')
  })

  it("marque 'exploration' quand les variants sont proches", () => {
    const variants: BanditVariant[] = [
      { id: 'v1', content: 'A', successes: 50, trials: 100 },
      { id: 'v2', content: 'B', successes: 48, trials: 100 },
      { id: 'v3', content: 'C', successes: 52, trials: 100 },
    ]
    // Variants quasi-équivalents → exploration attendue (mais on accepte aussi
    // exploitation occasionnelle selon le PRNG)
    const rng = mulberry32(31)
    let explorationCount = 0
    for (let i = 0; i < 20; i++) {
      const r = selectVariant(variants, rng)
      if (r.reason === 'exploration') explorationCount++
    }
    expect(explorationCount).toBeGreaterThanOrEqual(15)
  })
})

describe('computeWinProbability', () => {
  it('converge sur le bon winner pour un cas tranché', () => {
    const variants: BanditVariant[] = [
      { id: 'winner', content: 'A', successes: 800, trials: 1000 },
      { id: 'loser', content: 'B', successes: 200, trials: 1000 },
    ]
    const result = computeWinProbability(variants, 2000, mulberry32(11))
    expect(result.max_winner_id).toBe('winner')
    expect(result.max_probability).toBeGreaterThan(0.95)
    expect(result.total_trials).toBe(2000)
  })

  it('retourne max_probability proche de 0.5 pour 2 variants équivalents', () => {
    const variants: BanditVariant[] = [
      { id: 'a', content: 'A', successes: 200, trials: 400 },
      { id: 'b', content: 'B', successes: 200, trials: 400 },
    ]
    const result = computeWinProbability(variants, 3000, mulberry32(5))
    expect(result.max_probability).toBeGreaterThan(0.4)
    expect(result.max_probability).toBeLessThan(0.6)
  })

  it('iterations = 0 → max_probability = 0', () => {
    const variants: BanditVariant[] = [{ id: 'a', content: 'A', successes: 100, trials: 200 }]
    const result = computeWinProbability(variants, 0, mulberry32(0))
    expect(result.max_probability).toBe(0)
  })

  it('variants vides → throw', () => {
    expect(() => computeWinProbability([], 100, mulberry32(0))).toThrow()
  })

  it('total_trials = somme des trials des variants', () => {
    const variants: BanditVariant[] = [
      { id: 'a', content: 'A', successes: 50, trials: 100 },
      { id: 'b', content: 'B', successes: 30, trials: 200 },
      { id: 'c', content: 'C', successes: 20, trials: 300 },
    ]
    const result = computeWinProbability(variants, 100, mulberry32(0))
    expect(result.total_trials).toBe(600)
  })
})

describe('shouldConcludeBandit', () => {
  it('conclut quand winner_prob > 0.95 + trials >= 1000', () => {
    const variants: BanditVariant[] = [
      { id: 'winner', content: 'A', successes: 800, trials: 1000 },
      { id: 'loser', content: 'B', successes: 200, trials: 1000 },
    ]
    expect(shouldConcludeBandit(variants)).toBe(true)
  })

  it('ne conclut pas si trials cumulés < 1000', () => {
    const variants: BanditVariant[] = [
      { id: 'a', content: 'A', successes: 50, trials: 100 },
      { id: 'b', content: 'B', successes: 20, trials: 100 },
    ]
    expect(shouldConcludeBandit(variants)).toBe(false)
  })

  it('ne conclut pas si variants quasi-équivalents (winner_prob < threshold)', () => {
    const variants: BanditVariant[] = [
      { id: 'a', content: 'A', successes: 250, trials: 500 },
      { id: 'b', content: 'B', successes: 248, trials: 500 },
    ]
    expect(shouldConcludeBandit(variants, 0.95, 1000)).toBe(false)
  })

  it('conclut si un seul variant en lice', () => {
    expect(shouldConcludeBandit([{ id: 'only', content: 'A', successes: 0, trials: 0 }])).toBe(true)
  })

  it('respecte le seuil custom + min_trials custom', () => {
    const variants: BanditVariant[] = [
      { id: 'a', content: 'A', successes: 300, trials: 500 },
      { id: 'b', content: 'B', successes: 100, trials: 500 },
    ]
    // Avec un seuil très bas (0.5) et min_trials bas (500), on conclut.
    expect(shouldConcludeBandit(variants, 0.5, 500)).toBe(true)
  })
})
