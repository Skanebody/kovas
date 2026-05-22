/**
 * Vitest — `dpe-counter` (limite légale 1000 DPE/an).
 *
 * Vérifie les seuils d'alerte et la microcopy sobre adaptée à chaque palier.
 * Migration possible vers `dpe-counter.test.ts` quand la suite Vitest devient
 * la référence unique pour ce module.
 */

import { describe, expect, it } from 'vitest'
import { DPE_LEGAL_LIMIT, type DpeCounterResult, alertLevelFor, microcopyFor } from './dpe-counter'

describe("alertLevelFor — seuils d'alerte", () => {
  it("retourne 'none' sous 80%", () => {
    expect(alertLevelFor(0)).toBe('none')
    expect(alertLevelFor(50)).toBe('none')
    expect(alertLevelFor(79.99)).toBe('none')
  })

  it("retourne 'info' à 80-89%", () => {
    expect(alertLevelFor(80)).toBe('info')
    expect(alertLevelFor(85)).toBe('info')
    expect(alertLevelFor(89.99)).toBe('info')
  })

  it("retourne 'warning' à 90-94%", () => {
    expect(alertLevelFor(90)).toBe('warning')
    expect(alertLevelFor(94.99)).toBe('warning')
  })

  it("retourne 'critical' à 95-99%", () => {
    expect(alertLevelFor(95)).toBe('critical')
    expect(alertLevelFor(99)).toBe('critical')
  })

  it("retourne 'exceeded' à 100% et au-delà", () => {
    expect(alertLevelFor(100)).toBe('exceeded')
    expect(alertLevelFor(120)).toBe('exceeded')
  })
})

describe('microcopyFor — ton sobre avatar Benjamin Bel (vouvoiement)', () => {
  function makeResult(overrides: Partial<DpeCounterResult>): DpeCounterResult {
    return {
      count: 0,
      limit: DPE_LEGAL_LIMIT,
      percentage: 0,
      remaining: DPE_LEGAL_LIMIT,
      alertLevel: 'none',
      yearlyProjection: 0,
      ...overrides,
    }
  }

  it("propose une microcopy 'limite atteinte' quand exceeded", () => {
    const msg = microcopyFor(makeResult({ count: 1000, alertLevel: 'exceeded', remaining: 0 }))
    expect(msg).toMatch(/limite légale atteinte/i)
  })

  it("reste sobre — pas d'emoji marketing", () => {
    const msg = microcopyFor(
      makeResult({ count: 850, alertLevel: 'info', remaining: 150, yearlyProjection: 920 }),
    )
    expect(msg).not.toMatch(/[🚀🎯⭐🏆🎉]/u)
    // Vouvoiement attendu — la microcopy doit utiliser "vous"
    expect(msg).toMatch(/vous/i)
  })

  it('mentionne le nombre exact restants au seuil warning', () => {
    const msg = microcopyFor(
      makeResult({ count: 920, alertLevel: 'warning', remaining: 80, yearlyProjection: 1000 }),
    )
    expect(msg).toContain('80')
  })
})
