/**
 * Vitest — Algo A1.3.13 conformity pattern learning per diagnostician.
 */

import { describe, expect, it } from 'vitest'
import {
  applyPatternWeightsToAnomalies,
  computeDiagnosticianPatterns,
} from './diagnostician-pattern-learning'

describe('computeDiagnosticianPatterns', () => {
  it('returns baseline-only when total_missions < 15', () => {
    const res = computeDiagnosticianPatterns({
      history: [],
      total_missions: 8,
      months_since_signup: 3,
    })
    expect(res.use_baseline_only).toBe(true)
    expect(res.confidence).toBe(0.3)
    expect(res.blind_spots).toHaveLength(0)
    expect(res.personalized_warnings).toHaveLength(0)
  })

  it('returns baseline-only when months_since_signup < 2', () => {
    const res = computeDiagnosticianPatterns({
      history: [],
      total_missions: 50,
      months_since_signup: 1,
    })
    expect(res.use_baseline_only).toBe(true)
  })

  it('identifies strong blind spot for high error rate', () => {
    const res = computeDiagnosticianPatterns({
      history: [
        { category: 'vmc_oublie', occurrences: 12, applicable_missions: 25 }, // 48% rate
      ],
      total_missions: 30,
      months_since_signup: 6,
    })
    expect(res.use_baseline_only).toBe(false)
    expect(res.blind_spots).toHaveLength(1)
    expect(res.blind_spots[0]?.category).toBe('vmc_oublie')
    expect(res.blind_spots[0]?.error_rate_pct).toBe(48)
    expect(res.category_weights.vmc_oublie).toBe(1.5)
    expect(res.personalized_warnings[0]?.severity).toBe('strong_reminder')
  })

  it('caps blind_spots at top 3 sorted by error_rate', () => {
    const res = computeDiagnosticianPatterns({
      history: [
        { category: 'vmc_oublie', occurrences: 10, applicable_missions: 20 }, // 50%
        { category: 'photos_missing', occurrences: 8, applicable_missions: 20 }, // 40%
        { category: 'plomb_pre1949', occurrences: 4, applicable_missions: 20 }, // 20%
        { category: 'amiante_pre1997', occurrences: 3, applicable_missions: 20 }, // 15%
        { category: 'electricite_quotas', occurrences: 3, applicable_missions: 20 }, // 15%
      ],
      total_missions: 30,
      months_since_signup: 6,
    })
    expect(res.blind_spots).toHaveLength(3)
    expect(res.blind_spots[0]?.error_rate_pct).toBe(50)
    expect(res.blind_spots[1]?.error_rate_pct).toBe(40)
    expect(res.blind_spots[2]?.error_rate_pct).toBe(20)
  })

  it('caps personalized_warnings at 3 and only includes >= 20% error rate', () => {
    const res = computeDiagnosticianPatterns({
      history: [
        { category: 'vmc_oublie', occurrences: 10, applicable_missions: 20 }, // 50% strong
        { category: 'photos_missing', occurrences: 5, applicable_missions: 20 }, // 25% reminder
        { category: 'amiante_pre1997', occurrences: 3, applicable_missions: 20 }, // 15% — pas dans warnings
      ],
      total_missions: 30,
      months_since_signup: 6,
    })
    expect(res.personalized_warnings).toHaveLength(2)
    expect(res.personalized_warnings.find((w) => w.category === 'vmc_oublie')?.severity).toBe(
      'strong_reminder',
    )
    expect(res.personalized_warnings.find((w) => w.category === 'photos_missing')?.severity).toBe(
      'reminder',
    )
  })

  it('applies weight 0.8 for very low error rate (solid diag)', () => {
    const res = computeDiagnosticianPatterns({
      history: [
        { category: 'photos_missing', occurrences: 0, applicable_missions: 50 }, // 0%
      ],
      total_missions: 60,
      months_since_signup: 10,
    })
    expect(res.category_weights.photos_missing).toBe(0.8)
  })

  it('confidence scales with total_missions', () => {
    const fewMissions = computeDiagnosticianPatterns({
      history: [],
      total_missions: 20,
      months_since_signup: 3,
    })
    const manyMissions = computeDiagnosticianPatterns({
      history: [],
      total_missions: 150,
      months_since_signup: 12,
    })
    expect(fewMissions.confidence).toBeLessThan(manyMissions.confidence)
    expect(manyMissions.confidence).toBeLessThanOrEqual(0.95)
  })
})

describe('applyPatternWeightsToAnomalies', () => {
  it('boosts warning to critical when weight >= 1.3', () => {
    const anomalies = [{ category: 'vmc_oublie', severity: 'warning' as const, message: 'VMC' }]
    const res = applyPatternWeightsToAnomalies(anomalies, { vmc_oublie: 1.5 })
    expect(res[0]?.severity).toBe('critical')
  })

  it('boosts info to warning when weight >= 1.3', () => {
    const anomalies = [{ category: 'photos_missing', severity: 'info' as const, message: 'Photos' }]
    const res = applyPatternWeightsToAnomalies(anomalies, { photos_missing: 1.3 })
    expect(res[0]?.severity).toBe('warning')
  })

  it('filters out info anomalies when weight < 0.9', () => {
    const anomalies = [
      { category: 'photos_missing', severity: 'info' as const, message: 'Photos' },
      { category: 'vmc_oublie', severity: 'warning' as const, message: 'VMC' },
    ]
    const res = applyPatternWeightsToAnomalies(anomalies, {
      photos_missing: 0.8,
      vmc_oublie: 0.8,
    })
    expect(res).toHaveLength(1)
    expect(res[0]?.category).toBe('vmc_oublie')
  })

  it('keeps anomalies as-is when weight is around 1.0', () => {
    const anomalies = [{ category: 'vmc_oublie', severity: 'warning' as const, message: 'VMC' }]
    const res = applyPatternWeightsToAnomalies(anomalies, { vmc_oublie: 1.0 })
    expect(res[0]?.severity).toBe('warning')
  })
})
