import { describe, expect, it } from 'vitest'
import { detectProcessingVelocity } from './processing-velocity'

const baselineDiag = { yearsActive: 8, monthlyMissions: 25 }

describe('detectProcessingVelocity', () => {
  it('flags signature in 2 hours as critical fraud', () => {
    const signal = detectProcessingVelocity({
      createdAt: new Date('2026-05-22T10:00:00Z'),
      signedAt: new Date('2026-05-22T12:00:00Z'),
      diagnostician: baselineDiag,
    })
    expect(signal.flagged).toBe(true)
    expect(signal.severity).toBeGreaterThanOrEqual(0.9)
  })

  it('does not flag normal 10-day delay', () => {
    const signal = detectProcessingVelocity({
      createdAt: new Date('2026-05-01T10:00:00Z'),
      signedAt: new Date('2026-05-11T10:00:00Z'),
      diagnostician: baselineDiag,
    })
    expect(signal.severity).toBeLessThan(0.3)
  })

  it('flags 120-day delay as retroactive DPE', () => {
    const signal = detectProcessingVelocity({
      createdAt: new Date('2026-01-01T10:00:00Z'),
      signedAt: new Date('2026-05-01T10:00:00Z'),
      diagnostician: baselineDiag,
    })
    expect(signal.flagged).toBe(true)
    expect(signal.severity).toBeGreaterThanOrEqual(0.7)
  })

  it('moderates severity for industrial-volume cabinets', () => {
    const standardDiag = detectProcessingVelocity({
      createdAt: new Date('2026-05-22T08:00:00Z'),
      signedAt: new Date('2026-05-22T20:00:00Z'),
      diagnostician: { yearsActive: 10, monthlyMissions: 30 },
    })
    const industrialDiag = detectProcessingVelocity({
      createdAt: new Date('2026-05-22T08:00:00Z'),
      signedAt: new Date('2026-05-22T20:00:00Z'),
      diagnostician: { yearsActive: 10, monthlyMissions: 120 },
    })
    expect(industrialDiag.severity).toBeLessThan(standardDiag.severity)
  })

  it('returns severity=1 for impossible signedAt < createdAt', () => {
    const signal = detectProcessingVelocity({
      createdAt: new Date('2026-05-22T10:00:00Z'),
      signedAt: new Date('2026-05-21T10:00:00Z'),
      diagnostician: baselineDiag,
    })
    expect(signal.severity).toBe(1)
  })
})
