/**
 * Vitest — cascading Haiku→Sonnet decision logic + cost metrics (Lot B47).
 *
 * Pure-fn déterministes (zéro IO, zéro Math.random) — testables intégralement.
 */

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CASCADING_CONFIDENCE_THRESHOLD,
  computeCascadingMetrics,
  decideCascading,
  estimateCascadingSavings,
} from './cascading'

describe('decideCascading', () => {
  it('escalates Sonnet when confidence is null', () => {
    const d = decideCascading(null)
    expect(d.keep).toBe(false)
    expect(d.tier).toBe('sonnet')
    expect(d.reason).toMatch(/absente/i)
  })

  it('escalates Sonnet when confidence is undefined', () => {
    const d = decideCascading(undefined)
    expect(d.keep).toBe(false)
    expect(d.tier).toBe('sonnet')
  })

  it('escalates defensively when confidence is NaN', () => {
    const d = decideCascading(Number.NaN)
    expect(d.keep).toBe(false)
    expect(d.tier).toBe('sonnet')
    expect(d.reason).toMatch(/anormale/i)
  })

  it('escalates defensively when confidence > 1 (data anomaly)', () => {
    const d = decideCascading(1.5)
    expect(d.keep).toBe(false)
    expect(d.tier).toBe('sonnet')
  })

  it('escalates defensively when confidence < 0', () => {
    const d = decideCascading(-0.1)
    expect(d.keep).toBe(false)
    expect(d.tier).toBe('sonnet')
  })

  it('keeps Haiku when confidence == threshold exactly', () => {
    const d = decideCascading(DEFAULT_CASCADING_CONFIDENCE_THRESHOLD)
    expect(d.keep).toBe(true)
    expect(d.tier).toBe('haiku')
  })

  it('keeps Haiku when confidence > threshold', () => {
    const d = decideCascading(0.95)
    expect(d.keep).toBe(true)
    expect(d.tier).toBe('haiku')
    expect(d.reason).toMatch(/0\.95/)
  })

  it('escalates Sonnet when confidence below threshold', () => {
    const d = decideCascading(0.6)
    expect(d.keep).toBe(false)
    expect(d.tier).toBe('sonnet')
    expect(d.reason).toMatch(/0\.60/)
  })

  it('respects custom threshold parameter', () => {
    // Avec threshold 0.95, une confidence 0.9 doit escalader
    expect(decideCascading(0.9, 0.95).keep).toBe(false)
    // Avec threshold 0.5, une confidence 0.6 doit garder Haiku
    expect(decideCascading(0.6, 0.5).keep).toBe(true)
  })
})

describe('computeCascadingMetrics', () => {
  it('returns Haiku only metrics when no escalation', () => {
    const m = computeCascadingMetrics({
      haikuUsage: { input: 1500, output: 500 },
      sonnetUsage: null,
    })
    expect(m.escalated).toBe(false)
    expect(m.sonnet_cost_eur).toBe(0)
    expect(m.haiku_cost_eur).toBeGreaterThan(0)
    expect(m.total_cost_eur).toBe(m.haiku_cost_eur)
    expect(m.final_model).toMatch(/haiku/i)
  })

  it('returns combined metrics when escalation happens', () => {
    const m = computeCascadingMetrics({
      haikuUsage: { input: 1500, output: 500 },
      sonnetUsage: { input: 1500, output: 1000 },
    })
    expect(m.escalated).toBe(true)
    expect(m.haiku_cost_eur).toBeGreaterThan(0)
    expect(m.sonnet_cost_eur).toBeGreaterThan(m.haiku_cost_eur)
    expect(m.total_cost_eur).toBeCloseTo(m.haiku_cost_eur + m.sonnet_cost_eur, 6)
    expect(m.final_model).toMatch(/sonnet/i)
  })

  it('Haiku-only cost is ~3× cheaper than Sonnet-only for same payload', () => {
    const haikuOnly = computeCascadingMetrics({
      haikuUsage: { input: 1500, output: 500 },
      sonnetUsage: null,
    })
    const sonnetOnly = computeCascadingMetrics({
      haikuUsage: { input: 0, output: 0 },
      sonnetUsage: { input: 1500, output: 500 },
    })
    // Sonnet = 3× Haiku input + 3× Haiku output → environ 3× plus cher au total
    const ratio = sonnetOnly.total_cost_eur / haikuOnly.total_cost_eur
    expect(ratio).toBeGreaterThan(2.5)
    expect(ratio).toBeLessThan(3.5)
  })
})

describe('estimateCascadingSavings', () => {
  it('zero savings when escalation rate = 100% (toujours Sonnet en plus)', () => {
    const s = estimateCascadingSavings({
      totalAnalyses: 1000,
      escalationRate: 1.0,
    })
    // Cascading = 100% Haiku + 100% Sonnet = TOUJOURS plus cher que Sonnet seul
    expect(s.saved_eur).toBe(0)
    expect(s.saved_pct).toBe(0)
  })

  it('big savings when escalation rate = 0% (jamais d’escalation)', () => {
    const s = estimateCascadingSavings({
      totalAnalyses: 1000,
      escalationRate: 0,
    })
    // Cascading = 100% Haiku → 3× moins cher que Sonnet
    expect(s.saved_pct).toBeGreaterThan(60)
    expect(s.saved_eur).toBeGreaterThan(0)
  })

  it('significant savings at 30% escalation rate (alignement AI_ECONOMICS direction)', () => {
    const s = estimateCascadingSavings({
      totalAnalyses: 1000,
      escalationRate: 0.3,
    })
    // Le doc projette ~56% économie sur un payload moyen. Notre formule
    // exacte (1500 input + 500 output) donne ~37% — ordre de grandeur OK.
    // Les chiffres du doc supposent un payload plus gros ; pour valider
    // la _direction_ (cascading > baseline), on vérifie juste > 25%.
    expect(s.saved_pct).toBeGreaterThan(25)
    expect(s.saved_pct).toBeLessThan(70)
  })

  it('clamps escalation rate to [0, 1]', () => {
    const s1 = estimateCascadingSavings({ totalAnalyses: 1000, escalationRate: -0.5 })
    const s2 = estimateCascadingSavings({ totalAnalyses: 1000, escalationRate: 0 })
    expect(s1.cascading_cost_eur).toBe(s2.cascading_cost_eur)
    const s3 = estimateCascadingSavings({ totalAnalyses: 1000, escalationRate: 2 })
    const s4 = estimateCascadingSavings({ totalAnalyses: 1000, escalationRate: 1 })
    expect(s3.cascading_cost_eur).toBe(s4.cascading_cost_eur)
  })

  it('returns zero when totalAnalyses is 0', () => {
    const s = estimateCascadingSavings({ totalAnalyses: 0, escalationRate: 0.3 })
    expect(s.baseline_cost_eur).toBe(0)
    expect(s.cascading_cost_eur).toBe(0)
    expect(s.saved_eur).toBe(0)
  })

  it('respects custom avgInputTokens / avgOutputTokens', () => {
    const small = estimateCascadingSavings({
      totalAnalyses: 1000,
      escalationRate: 0.3,
      avgInputTokens: 100,
      avgOutputTokens: 50,
    })
    const big = estimateCascadingSavings({
      totalAnalyses: 1000,
      escalationRate: 0.3,
      avgInputTokens: 10_000,
      avgOutputTokens: 5_000,
    })
    expect(big.baseline_cost_eur).toBeGreaterThan(small.baseline_cost_eur * 10)
  })
})
