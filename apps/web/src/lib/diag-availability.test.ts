/**
 * Vitest — helpers de réactivité/fraîcheur fiche publique (B37).
 *
 * Pure-fn déterministes (zéro IO, zéro Math.random) — testables intégralement.
 */

import { describe, expect, it } from 'vitest'
import {
  bucketResponseSpeed,
  computeAvailabilitySignals,
  formatDateFr,
  formatResponseSentence,
  formatUpdatedSentence,
  formatVerifiedSentence,
} from './diag-availability'

describe('bucketResponseSpeed', () => {
  it('returns "unknown" for null', () => {
    expect(bucketResponseSpeed(null)).toBe('unknown')
  })

  it('returns "unknown" for negative input (data anomaly)', () => {
    expect(bucketResponseSpeed(-10)).toBe('unknown')
  })

  it('returns "fast" up to 4 hours', () => {
    expect(bucketResponseSpeed(30)).toBe('fast')
    expect(bucketResponseSpeed(4 * 60)).toBe('fast')
  })

  it('returns "standard" between 4h and 24h ouvrées', () => {
    expect(bucketResponseSpeed(4 * 60 + 1)).toBe('standard')
    expect(bucketResponseSpeed(12 * 60)).toBe('standard')
    expect(bucketResponseSpeed(24 * 60)).toBe('standard')
  })

  it('returns "slow" past 24h', () => {
    expect(bucketResponseSpeed(48 * 60)).toBe('slow')
    expect(bucketResponseSpeed(7 * 24 * 60)).toBe('slow')
  })
})

describe('formatResponseSentence', () => {
  it('returns null when sample_size < 3', () => {
    expect(formatResponseSentence(30, 2).sentence).toBeNull()
  })

  it('returns null when minutes is null', () => {
    expect(formatResponseSentence(null, 10).sentence).toBeNull()
  })

  it('returns "sous 1 heure" for < 60 min', () => {
    const r = formatResponseSentence(45, 10)
    expect(r.sentence).toBe('Répond généralement sous 1 heure')
    expect(r.bucket).toBe('fast')
  })

  it('returns "sous 2 heures" for 60-120 min', () => {
    expect(formatResponseSentence(90, 5).sentence).toBe('Répond généralement sous 2 heures')
  })

  it('returns "sous 4 heures" for 121-240 min', () => {
    expect(formatResponseSentence(180, 5).sentence).toBe('Répond généralement sous 4 heures')
  })

  it('returns "sous 8 heures" for 4h-8h', () => {
    expect(formatResponseSentence(5 * 60, 5).sentence).toBe('Répond généralement sous 8 heures')
  })

  it('returns "sous 24 heures ouvrées" for 8h-24h', () => {
    const r = formatResponseSentence(20 * 60, 5)
    expect(r.sentence).toBe('Répond généralement sous 24 heures ouvrées')
    expect(r.bucket).toBe('standard')
  })

  it('returns "sous 48 heures" past 24h up to 48h', () => {
    const r = formatResponseSentence(36 * 60, 5)
    expect(r.sentence).toBe('Répond généralement sous 48 heures')
    expect(r.bucket).toBe('slow')
  })

  it('returns "sous quelques jours" past 48h', () => {
    expect(formatResponseSentence(72 * 60, 5).sentence).toBe(
      'Répond généralement sous quelques jours',
    )
  })
})

describe('formatDateFr', () => {
  it('returns null for null', () => {
    expect(formatDateFr(null)).toBeNull()
  })

  it('returns null for invalid date string', () => {
    expect(formatDateFr('not-a-date')).toBeNull()
  })

  it('formats ISO string in French', () => {
    expect(formatDateFr('2026-05-12T10:00:00Z')).toBe('12 mai 2026')
  })

  it('formats Date object in French', () => {
    expect(formatDateFr(new Date('2026-01-03T12:00:00Z'))).toBe('3 janvier 2026')
  })
})

describe('formatVerifiedSentence', () => {
  const now = new Date('2026-05-25T00:00:00Z')

  it('returns null when last_verified_at is null', () => {
    expect(formatVerifiedSentence(null, now)).toBeNull()
  })

  it('returns simple sentence when verified <= 30 days ago', () => {
    expect(formatVerifiedSentence('2026-05-10T00:00:00Z', now)).toBe(
      'Profil vérifié le 10 mai 2026',
    )
  })

  it('returns simple sentence when verified between 30 and 180 days ago', () => {
    expect(formatVerifiedSentence('2026-02-01T00:00:00Z', now)).toBe(
      'Profil vérifié le 1 février 2026',
    )
  })

  it('adds renouvelée suffix when verified > 180 days ago', () => {
    expect(formatVerifiedSentence('2025-09-01T00:00:00Z', now)).toBe(
      'Profil vérifié le 1 septembre 2025 (vérification renouvelée régulièrement)',
    )
  })
})

describe('formatUpdatedSentence', () => {
  it('returns null for null', () => {
    expect(formatUpdatedSentence(null)).toBeNull()
  })

  it('formats updated sentence', () => {
    expect(formatUpdatedSentence('2026-05-22T15:00:00Z')).toBe('Profil mis à jour le 22 mai 2026')
  })
})

describe('computeAvailabilitySignals', () => {
  const now = new Date('2026-05-25T00:00:00Z')

  it('returns all 3 signals when data is complete', () => {
    const r = computeAvailabilitySignals({
      median_response_minutes: 45,
      sample_size: 10,
      last_verified_at: '2026-05-10T00:00:00Z',
      updated_at: '2026-05-22T00:00:00Z',
      now,
    })
    expect(r.responseSentence).toBe('Répond généralement sous 1 heure')
    expect(r.responseBucket).toBe('fast')
    expect(r.verifiedSentence).toBe('Profil vérifié le 10 mai 2026')
    expect(r.updatedSentence).toBe('Profil mis à jour le 22 mai 2026')
    expect(r.signalsCount).toBe(3)
  })

  it('omits response sentence when sample too small', () => {
    const r = computeAvailabilitySignals({
      median_response_minutes: 30,
      sample_size: 1,
      last_verified_at: '2026-05-10T00:00:00Z',
      updated_at: '2026-05-22T00:00:00Z',
      now,
    })
    expect(r.responseSentence).toBeNull()
    expect(r.signalsCount).toBe(2)
  })

  it('omits verified when never verified (NULL)', () => {
    const r = computeAvailabilitySignals({
      median_response_minutes: 200,
      sample_size: 5,
      last_verified_at: null,
      updated_at: '2026-05-22T00:00:00Z',
      now,
    })
    expect(r.verifiedSentence).toBeNull()
    expect(r.responseSentence).toBe('Répond généralement sous 4 heures')
    expect(r.updatedSentence).toBe('Profil mis à jour le 22 mai 2026')
    expect(r.signalsCount).toBe(2)
  })

  it('returns 0 signals when all data missing', () => {
    const r = computeAvailabilitySignals({
      median_response_minutes: null,
      sample_size: 0,
      last_verified_at: null,
      updated_at: null,
      now,
    })
    expect(r.signalsCount).toBe(0)
    expect(r.responseBucket).toBe('unknown')
  })
})
