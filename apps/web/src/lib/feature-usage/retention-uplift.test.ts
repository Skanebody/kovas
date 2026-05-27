import { describe, expect, it } from 'vitest'
import type { FeatureId } from './features-catalog'
import { type RetentionCohort, computeRetentionUplift } from './retention-uplift'

function makeUsersCohort(
  feature_id: FeatureId,
  overrides: Partial<RetentionCohort> = {},
): RetentionCohort {
  return {
    feature_id,
    cohort_label: 'users',
    user_count: 200,
    retained_at_day_30: 180,
    retained_at_day_60: 156,
    retained_at_day_90: 130,
    ...overrides,
  }
}

function makeNonUsersCohort(
  feature_id: FeatureId,
  overrides: Partial<RetentionCohort> = {},
): RetentionCohort {
  return {
    feature_id,
    cohort_label: 'non_users',
    user_count: 120,
    retained_at_day_30: 80,
    retained_at_day_60: 64,
    retained_at_day_90: 48,
    ...overrides,
  }
}

describe('computeRetentionUplift — uplift calcul', () => {
  it('calcule uplift en points absolus à D30/D60/D90', () => {
    const users = makeUsersCohort('voice_capture')
    const non = makeNonUsersCohort('voice_capture')
    const result = computeRetentionUplift(users, non)

    // users D60 = 156/200 = 78%. non_users D60 = 64/120 = 53.33%. uplift ≈ 24.67
    expect(result.d60_uplift_pct).toBeCloseTo(24.67, 1)
    expect(result.d30_uplift_pct).toBeCloseTo(90 - 66.67, 1)
    expect(result.d90_uplift_pct).toBeCloseTo(65 - 40, 1)
  })

  it('uplift négatif si non-users retiennent mieux (cas inversé)', () => {
    const users = makeUsersCohort('voice_capture', {
      user_count: 100,
      retained_at_day_30: 50,
      retained_at_day_60: 40,
      retained_at_day_90: 30,
    })
    const non = makeNonUsersCohort('voice_capture', {
      user_count: 100,
      retained_at_day_30: 80,
      retained_at_day_60: 70,
      retained_at_day_90: 60,
    })
    const result = computeRetentionUplift(users, non)
    expect(result.d60_uplift_pct).toBe(-30)
  })

  it('retentionPct=0 si user_count=0 (pas de NaN)', () => {
    const users = makeUsersCohort('voice_capture', {
      user_count: 0,
      retained_at_day_30: 0,
      retained_at_day_60: 0,
      retained_at_day_90: 0,
    })
    const non = makeNonUsersCohort('voice_capture')
    const result = computeRetentionUplift(users, non)
    expect(result.d60_uplift_pct).toBe(-(64 / 120) * 100)
    expect(Number.isNaN(result.d60_uplift_pct)).toBe(false)
  })
})

describe('computeRetentionUplift — confidence buckets', () => {
  it("'high' si total >= 200 ET min(cohorte) >= 50", () => {
    const users = makeUsersCohort('voice_capture', { user_count: 200 })
    const non = makeNonUsersCohort('voice_capture', { user_count: 120 })
    const result = computeRetentionUplift(users, non)
    expect(result.statistical_confidence).toBe('high')
  })

  it("'medium' si total >= 100 mais total < 200", () => {
    const users = makeUsersCohort('voice_capture', {
      user_count: 80,
      retained_at_day_30: 70,
      retained_at_day_60: 60,
      retained_at_day_90: 50,
    })
    const non = makeNonUsersCohort('voice_capture', {
      user_count: 40,
      retained_at_day_30: 25,
      retained_at_day_60: 20,
      retained_at_day_90: 15,
    })
    const result = computeRetentionUplift(users, non)
    expect(result.statistical_confidence).toBe('medium')
  })

  it("'low' si total < 100", () => {
    const users = makeUsersCohort('voice_capture', {
      user_count: 30,
      retained_at_day_30: 25,
      retained_at_day_60: 20,
      retained_at_day_90: 18,
    })
    const non = makeNonUsersCohort('voice_capture', {
      user_count: 30,
      retained_at_day_30: 20,
      retained_at_day_60: 15,
      retained_at_day_90: 10,
    })
    const result = computeRetentionUplift(users, non)
    expect(result.statistical_confidence).toBe('low')
  })

  it("'medium' (pas 'high') si total >= 200 mais une cohorte minuscule (<50)", () => {
    // 195 + 30 = 225 total mais min=30 < 50
    const users = makeUsersCohort('voice_capture', {
      user_count: 195,
      retained_at_day_30: 175,
      retained_at_day_60: 150,
      retained_at_day_90: 125,
    })
    const non = makeNonUsersCohort('voice_capture', {
      user_count: 30,
      retained_at_day_30: 20,
      retained_at_day_60: 15,
      retained_at_day_90: 10,
    })
    const result = computeRetentionUplift(users, non)
    expect(result.statistical_confidence).toBe('medium')
  })
})

describe('computeRetentionUplift — recommendation gates', () => {
  it("'high_priority_promote' si d60_uplift >= 20 ET confidence=high", () => {
    const users = makeUsersCohort('voice_capture', {
      user_count: 200,
      retained_at_day_60: 160,
    }) // 80%
    const non = makeNonUsersCohort('voice_capture', {
      user_count: 150,
      retained_at_day_60: 75,
    }) // 50%
    const result = computeRetentionUplift(users, non)
    expect(result.d60_uplift_pct).toBe(30)
    expect(result.statistical_confidence).toBe('high')
    expect(result.recommendation).toBe('high_priority_promote')
  })

  it("'consider_promote' si d60_uplift >= 10 ET confidence=medium", () => {
    // medium confidence : total ~120 with both cohorts >= some
    const users = makeUsersCohort('voice_capture', {
      user_count: 80,
      retained_at_day_60: 60,
    }) // 75%
    const non = makeNonUsersCohort('voice_capture', {
      user_count: 40,
      retained_at_day_60: 24,
    }) // 60%
    const result = computeRetentionUplift(users, non)
    expect(result.d60_uplift_pct).toBe(15)
    expect(result.statistical_confidence).toBe('medium')
    expect(result.recommendation).toBe('consider_promote')
  })

  it("'no_action' si d60_uplift >= 20 mais confidence=low (sample trop petit)", () => {
    const users = makeUsersCohort('voice_capture', {
      user_count: 30,
      retained_at_day_60: 24,
    }) // 80%
    const non = makeNonUsersCohort('voice_capture', {
      user_count: 20,
      retained_at_day_60: 10,
    }) // 50%
    const result = computeRetentionUplift(users, non)
    expect(result.d60_uplift_pct).toBe(30)
    expect(result.statistical_confidence).toBe('low')
    expect(result.recommendation).toBe('no_action')
  })

  it("'no_action' si d60_uplift < 10 même avec confidence=high", () => {
    const users = makeUsersCohort('voice_capture', {
      user_count: 200,
      retained_at_day_60: 140,
    }) // 70%
    const non = makeNonUsersCohort('voice_capture', {
      user_count: 150,
      retained_at_day_60: 100,
    }) // 66.67%
    const result = computeRetentionUplift(users, non)
    expect(result.d60_uplift_pct).toBeLessThan(10)
    expect(result.recommendation).toBe('no_action')
  })
})

describe('computeRetentionUplift — human_message', () => {
  it('contient le feature_id et le uplift D60 en points + sample size', () => {
    const users = makeUsersCohort('voice_capture')
    const non = makeNonUsersCohort('voice_capture')
    const result = computeRetentionUplift(users, non)
    expect(result.human_message).toContain('voice_capture')
    expect(result.human_message).toContain('D60')
    expect(result.human_message).toMatch(/320 users/)
  })

  it("mentionne 'Promotion haute priorité' pour high_priority_promote", () => {
    const users = makeUsersCohort('voice_capture', { retained_at_day_60: 160 })
    const non = makeNonUsersCohort('voice_capture', {
      user_count: 150,
      retained_at_day_60: 75,
    })
    const result = computeRetentionUplift(users, non)
    expect(result.human_message).toContain('Promotion haute priorité')
  })

  it("mentionne le signe '+' pour uplift positif", () => {
    const users = makeUsersCohort('voice_capture')
    const non = makeNonUsersCohort('voice_capture')
    const result = computeRetentionUplift(users, non)
    expect(result.human_message).toMatch(/\+\d/)
  })
})

describe('computeRetentionUplift — garde-fous programmation', () => {
  it('throw si feature_id mismatch entre cohortes', () => {
    const users = makeUsersCohort('voice_capture')
    const non = makeNonUsersCohort('analytics')
    expect(() => computeRetentionUplift(users, non)).toThrow(/feature_id mismatch/)
  })

  it("throw si cohort_label de la cohorte 1 n'est pas 'users'", () => {
    const wrong: RetentionCohort = {
      ...makeUsersCohort('voice_capture'),
      cohort_label: 'non_users',
    }
    const non = makeNonUsersCohort('voice_capture')
    expect(() => computeRetentionUplift(wrong, non)).toThrow(/cohort_label='users'/)
  })

  it("throw si cohort_label de la cohorte 2 n'est pas 'non_users'", () => {
    const users = makeUsersCohort('voice_capture')
    const wrong: RetentionCohort = {
      ...makeNonUsersCohort('voice_capture'),
      cohort_label: 'users',
    }
    expect(() => computeRetentionUplift(users, wrong)).toThrow(/cohort_label='non_users'/)
  })
})
