import { describe, expect, it } from 'vitest'
import { type VariantStats, getTopWinners, rankVariants, scoreVariant } from './subject-scorer'

function makeStats(overrides: Partial<VariantStats> = {}): VariantStats {
  return {
    variant_id: 'v1',
    variant_content: 'Test subject',
    sent_count: 1000,
    open_count: 400,
    click_count: 100,
    conversion_count: 50,
    unsubscribe_count: 5,
    generated_at: '2026-05-27T12:00:00Z',
    ...overrides,
  }
}

describe('scoreVariant — anti divide-by-zero', () => {
  it('retourne tous rates à 0 si sent_count = 0', () => {
    const score = scoreVariant(makeStats({ sent_count: 0 }), 'open_rate')
    expect(score.open_rate).toBe(0)
    expect(score.click_rate).toBe(0)
    expect(score.conversion_rate).toBe(0)
    expect(score.unsubscribe_rate).toBe(0)
    expect(score.composite_score).toBe(0)
    expect(score.confidence).toBe(0)
  })

  it('retourne tous rates à 0 si sent_count négatif', () => {
    const score = scoreVariant(makeStats({ sent_count: -10 }), 'open_rate')
    expect(score.composite_score).toBe(0)
    expect(score.confidence).toBe(0)
  })

  it('calcule open_rate correctement (400/1000 = 0.4)', () => {
    const score = scoreVariant(makeStats(), 'open_rate')
    expect(score.open_rate).toBeCloseTo(0.4, 5)
  })

  it('calcule click_rate sur opens (100/400 = 0.25)', () => {
    const score = scoreVariant(makeStats(), 'open_rate')
    expect(score.click_rate).toBeCloseTo(0.25, 5)
  })

  it('click_rate = 0 si open_count = 0', () => {
    const score = scoreVariant(makeStats({ open_count: 0, click_count: 0 }), 'open_rate')
    expect(score.click_rate).toBe(0)
  })
})

describe('scoreVariant — composite_score par KPI', () => {
  it('composite open_rate = 0.7*open + 0.2*click - 0.5*unsub', () => {
    // open=0.4, click=0.25, unsub=0.005
    // = 0.7*0.4 + 0.2*0.25 - 0.5*0.005
    // = 0.28 + 0.05 - 0.0025 = 0.3275
    const score = scoreVariant(makeStats(), 'open_rate')
    expect(score.composite_score).toBeCloseTo(0.3275, 3)
  })

  it('composite click_rate = 0.4*open + 0.5*click - 0.5*unsub', () => {
    // = 0.4*0.4 + 0.5*0.25 - 0.5*0.005
    // = 0.16 + 0.125 - 0.0025 = 0.2825
    const score = scoreVariant(makeStats(), 'click_rate')
    expect(score.composite_score).toBeCloseTo(0.2825, 3)
  })

  it('composite conversion_rate = 0.2*open + 0.3*click + 0.5*conv - 1.0*unsub', () => {
    // open=0.4, click=0.25, conv=50/1000=0.05, unsub=0.005
    // = 0.2*0.4 + 0.3*0.25 + 0.5*0.05 - 1.0*0.005
    // = 0.08 + 0.075 + 0.025 - 0.005 = 0.175
    const score = scoreVariant(makeStats(), 'conversion_rate')
    expect(score.composite_score).toBeCloseTo(0.175, 3)
  })

  it('clamp composite à [0, 1] — pénalité unsub forte', () => {
    const score = scoreVariant(
      makeStats({ open_count: 100, click_count: 10, unsubscribe_count: 800 }),
      'conversion_rate',
    )
    expect(score.composite_score).toBeGreaterThanOrEqual(0)
    expect(score.composite_score).toBeLessThanOrEqual(1)
  })
})

describe('scoreVariant — confidence sigmoid', () => {
  it('sent_count = 0 → confidence = 0', () => {
    const score = scoreVariant(makeStats({ sent_count: 0 }), 'open_rate')
    expect(score.confidence).toBe(0)
  })

  it('sent_count = 50 → confidence faible (< 0.15)', () => {
    const score = scoreVariant(makeStats({ sent_count: 50 }), 'open_rate')
    expect(score.confidence).toBeLessThan(0.15)
  })

  it("sent_count = 250 → confidence ≈ 0.5 (point d'inflexion)", () => {
    const score = scoreVariant(makeStats({ sent_count: 250 }), 'open_rate')
    expect(score.confidence).toBeCloseTo(0.5, 1)
  })

  it('sent_count = 500 → confidence > 0.9', () => {
    const score = scoreVariant(makeStats({ sent_count: 500 }), 'open_rate')
    expect(score.confidence).toBeGreaterThan(0.9)
  })

  it('sent_count = 5000 → confidence ≈ 1.0', () => {
    const score = scoreVariant(makeStats({ sent_count: 5000 }), 'open_rate')
    expect(score.confidence).toBeGreaterThan(0.99)
  })
})

describe('rankVariants — tri stable décroissant', () => {
  it('classe les variants par composite_score décroissant', () => {
    const stats: VariantStats[] = [
      makeStats({ variant_id: 'low', open_count: 100 }),
      makeStats({ variant_id: 'high', open_count: 500 }),
      makeStats({ variant_id: 'mid', open_count: 300 }),
    ]
    const ranked = rankVariants(stats, 'open_rate')
    expect(ranked[0]?.variant_id).toBe('high')
    expect(ranked[1]?.variant_id).toBe('mid')
    expect(ranked[2]?.variant_id).toBe('low')
  })

  it("est stable en cas d'égalité (conserve ordre d'entrée)", () => {
    const stats: VariantStats[] = [
      makeStats({ variant_id: 'a' }),
      makeStats({ variant_id: 'b' }),
      makeStats({ variant_id: 'c' }),
    ]
    const ranked = rankVariants(stats, 'open_rate')
    expect(ranked[0]?.variant_id).toBe('a')
    expect(ranked[1]?.variant_id).toBe('b')
    expect(ranked[2]?.variant_id).toBe('c')
  })

  it('tie-break sur confidence (sent_count plus élevé gagne)', () => {
    // Mêmes ratios exactement, sent_count différent → confidence départage
    const stats: VariantStats[] = [
      makeStats({
        variant_id: 'small',
        sent_count: 100,
        open_count: 40,
        click_count: 10,
        conversion_count: 5,
        unsubscribe_count: 1,
      }),
      makeStats({
        variant_id: 'big',
        sent_count: 1000,
        open_count: 400,
        click_count: 100,
        conversion_count: 50,
        unsubscribe_count: 10,
      }),
    ]
    const ranked = rankVariants(stats, 'open_rate')
    expect(ranked[0]?.variant_id).toBe('big')
  })

  it('array vide retourne array vide', () => {
    const ranked = rankVariants([], 'open_rate')
    expect(ranked).toEqual([])
  })
})

describe('getTopWinners', () => {
  it('retourne les N meilleurs', () => {
    const stats: VariantStats[] = [
      makeStats({ variant_id: 'a', open_count: 100 }),
      makeStats({ variant_id: 'b', open_count: 500 }),
      makeStats({ variant_id: 'c', open_count: 300 }),
      makeStats({ variant_id: 'd', open_count: 700 }),
    ]
    const top2 = getTopWinners(stats, 'open_rate', 2)
    expect(top2.length).toBe(2)
    expect(top2[0]?.variant_id).toBe('d')
    expect(top2[1]?.variant_id).toBe('b')
  })

  it('count = 0 retourne array vide', () => {
    const stats = [makeStats()]
    expect(getTopWinners(stats, 'open_rate', 0)).toEqual([])
  })

  it('count > variants.length retourne tous les variants', () => {
    const stats = [makeStats({ variant_id: 'a' }), makeStats({ variant_id: 'b' })]
    const top = getTopWinners(stats, 'open_rate', 10)
    expect(top.length).toBe(2)
  })
})
