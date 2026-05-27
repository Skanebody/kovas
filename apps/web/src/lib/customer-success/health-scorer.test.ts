import { describe, expect, it } from 'vitest'
import { type HealthScoreInput, computeHealthScore } from './health-scorer'

const baseInput: HealthScoreInput = {
  logins_last_30d: 18,
  missions_completed_last_30d: 24,
  features_used_last_30d_count: 7,
  cross_check_avg_score: 78,
  sentiment_avg_last_30d: 0.5,
  payment_status: 'active',
  failed_payments_last_90d: 0,
  tenure_months: 6,
}

describe('computeHealthScore — dimensions', () => {
  it('retourne exactement 5 dimensions avec poids dont la somme vaut 1.00', () => {
    const result = computeHealthScore(baseInput)
    expect(result.dimensions).toHaveLength(5)
    const sum = result.dimensions.reduce((acc, d) => acc + d.weight, 0)
    expect(sum).toBeCloseTo(1, 5)
  })

  it('calcule engagement à 100 si 20+ logins et 30+ missions', () => {
    const result = computeHealthScore({
      ...baseInput,
      logins_last_30d: 25,
      missions_completed_last_30d: 35,
    })
    const eng = result.dimensions.find((d) => d.dimension === 'engagement')
    expect(eng?.score).toBe(100)
  })

  it('calcule engagement à 0 si aucun login ni mission', () => {
    const result = computeHealthScore({
      ...baseInput,
      logins_last_30d: 0,
      missions_completed_last_30d: 0,
    })
    const eng = result.dimensions.find((d) => d.dimension === 'engagement')
    expect(eng?.score).toBe(0)
  })

  it('calcule product_adoption à 100 si 8 features sur 12 utilisées (pas besoin des 12)', () => {
    const result = computeHealthScore({ ...baseInput, features_used_last_30d_count: 8 })
    const ad = result.dimensions.find((d) => d.dimension === 'product_adoption')
    expect(ad?.score).toBe(100)
  })

  it('plafonne product_adoption à 100 même si plus de 8 features', () => {
    const result = computeHealthScore({ ...baseInput, features_used_last_30d_count: 12 })
    const ad = result.dimensions.find((d) => d.dimension === 'product_adoption')
    expect(ad?.score).toBe(100)
  })

  it('utilise performance=50 (neutre) si cross_check_avg_score=null', () => {
    const result = computeHealthScore({ ...baseInput, cross_check_avg_score: null })
    const perf = result.dimensions.find((d) => d.dimension === 'performance')
    expect(perf?.score).toBe(50)
    expect(perf?.detail).toContain('non mesurée')
  })

  it('renvoie performance = cross_check_avg_score quand mesuré', () => {
    const result = computeHealthScore({ ...baseInput, cross_check_avg_score: 92 })
    const perf = result.dimensions.find((d) => d.dimension === 'performance')
    expect(perf?.score).toBe(92)
  })

  it('utilise satisfaction=60 (positif neutre) si sentiment=null', () => {
    const result = computeHealthScore({ ...baseInput, sentiment_avg_last_30d: null })
    const sat = result.dimensions.find((d) => d.dimension === 'satisfaction')
    expect(sat?.score).toBe(60)
  })

  it('mappe sentiment -1 → satisfaction 0', () => {
    const result = computeHealthScore({ ...baseInput, sentiment_avg_last_30d: -1 })
    const sat = result.dimensions.find((d) => d.dimension === 'satisfaction')
    expect(sat?.score).toBe(0)
  })

  it('mappe sentiment 0 → satisfaction 50', () => {
    const result = computeHealthScore({ ...baseInput, sentiment_avg_last_30d: 0 })
    const sat = result.dimensions.find((d) => d.dimension === 'satisfaction')
    expect(sat?.score).toBe(50)
  })

  it('mappe sentiment +1 → satisfaction 100', () => {
    const result = computeHealthScore({ ...baseInput, sentiment_avg_last_30d: 1 })
    const sat = result.dimensions.find((d) => d.dimension === 'satisfaction')
    expect(sat?.score).toBe(100)
  })

  it('clamp sentiment hors borne [-1, +1]', () => {
    const result = computeHealthScore({ ...baseInput, sentiment_avg_last_30d: -2 })
    const sat = result.dimensions.find((d) => d.dimension === 'satisfaction')
    expect(sat?.score).toBe(0)
  })
})

describe('computeHealthScore — dimension business', () => {
  it('payment_status=active → score business 100 (sans bonus si tenure < 6)', () => {
    const result = computeHealthScore({
      ...baseInput,
      payment_status: 'active',
      tenure_months: 3,
    })
    const biz = result.dimensions.find((d) => d.dimension === 'business')
    expect(biz?.score).toBe(100)
  })

  it('payment_status=trialing → score business 80', () => {
    const result = computeHealthScore({
      ...baseInput,
      payment_status: 'trialing',
      tenure_months: 0,
    })
    const biz = result.dimensions.find((d) => d.dimension === 'business')
    expect(biz?.score).toBe(80)
  })

  it('payment_status=past_due → score 30 - (failed × 10)', () => {
    const result = computeHealthScore({
      ...baseInput,
      payment_status: 'past_due',
      failed_payments_last_90d: 2,
      tenure_months: 0,
    })
    const biz = result.dimensions.find((d) => d.dimension === 'business')
    expect(biz?.score).toBe(10) // 30 - 2*10
  })

  it('payment_status=past_due ne descend pas en dessous de 0', () => {
    const result = computeHealthScore({
      ...baseInput,
      payment_status: 'past_due',
      failed_payments_last_90d: 5,
      tenure_months: 0,
    })
    const biz = result.dimensions.find((d) => d.dimension === 'business')
    expect(biz?.score).toBe(0)
  })

  it('payment_status=paused → score 40', () => {
    const result = computeHealthScore({
      ...baseInput,
      payment_status: 'paused',
      tenure_months: 0,
    })
    const biz = result.dimensions.find((d) => d.dimension === 'business')
    expect(biz?.score).toBe(40)
  })

  it('payment_status=canceled → score 0', () => {
    const result = computeHealthScore({
      ...baseInput,
      payment_status: 'canceled',
      tenure_months: 24,
    })
    const biz = result.dimensions.find((d) => d.dimension === 'business')
    // 0 + bonus tenure 10 = 10
    expect(biz?.score).toBe(10)
  })

  it('payment_status=unpaid → score 0', () => {
    const result = computeHealthScore({
      ...baseInput,
      payment_status: 'unpaid',
      tenure_months: 0,
    })
    const biz = result.dimensions.find((d) => d.dimension === 'business')
    expect(biz?.score).toBe(0)
  })

  it('bonus tenure +5 à 6 mois', () => {
    const a = computeHealthScore({
      ...baseInput,
      payment_status: 'paused',
      tenure_months: 5,
    })
    const b = computeHealthScore({
      ...baseInput,
      payment_status: 'paused',
      tenure_months: 6,
    })
    const ptsA = a.dimensions.find((d) => d.dimension === 'business')?.score ?? 0
    const ptsB = b.dimensions.find((d) => d.dimension === 'business')?.score ?? 0
    expect(ptsB - ptsA).toBe(5)
  })

  it('bonus tenure +10 à 12 mois', () => {
    const result = computeHealthScore({
      ...baseInput,
      payment_status: 'paused',
      tenure_months: 14,
    })
    const biz = result.dimensions.find((d) => d.dimension === 'business')
    expect(biz?.score).toBe(50) // 40 + 10
  })

  it('plafonne business à 100 même avec bonus tenure long', () => {
    const result = computeHealthScore({
      ...baseInput,
      payment_status: 'active',
      tenure_months: 36,
    })
    const biz = result.dimensions.find((d) => d.dimension === 'business')
    expect(biz?.score).toBe(100)
  })
})

describe('computeHealthScore — composite et buckets', () => {
  it("renvoie bucket 'promoter' pour score >= 80", () => {
    const result = computeHealthScore({
      ...baseInput,
      logins_last_30d: 25,
      missions_completed_last_30d: 35,
      features_used_last_30d_count: 10,
      cross_check_avg_score: 95,
      sentiment_avg_last_30d: 0.9,
    })
    expect(result.bucket).toBe('promoter')
    expect(result.score).toBeGreaterThanOrEqual(80)
  })

  it("renvoie bucket 'healthy' pour score 60-79", () => {
    // Réglages calibrés pour tomber dans la fourchette 60-79
    const result = computeHealthScore({
      logins_last_30d: 12,
      missions_completed_last_30d: 15,
      features_used_last_30d_count: 5,
      cross_check_avg_score: 65,
      sentiment_avg_last_30d: 0.2,
      payment_status: 'active',
      failed_payments_last_90d: 0,
      tenure_months: 4,
    })
    expect(result.bucket).toBe('healthy')
    expect(result.score).toBeGreaterThanOrEqual(60)
    expect(result.score).toBeLessThan(80)
  })

  it("renvoie bucket 'at_risk' pour score 40-59", () => {
    const result = computeHealthScore({
      ...baseInput,
      logins_last_30d: 5,
      missions_completed_last_30d: 8,
      features_used_last_30d_count: 3,
      cross_check_avg_score: 50,
      sentiment_avg_last_30d: -0.1,
    })
    expect(result.bucket).toBe('at_risk')
    expect(result.score).toBeGreaterThanOrEqual(40)
    expect(result.score).toBeLessThan(60)
  })

  it("renvoie bucket 'critical' pour score < 40", () => {
    const result = computeHealthScore({
      logins_last_30d: 1,
      missions_completed_last_30d: 1,
      features_used_last_30d_count: 0,
      cross_check_avg_score: 20,
      sentiment_avg_last_30d: -0.8,
      payment_status: 'past_due',
      failed_payments_last_90d: 3,
      tenure_months: 1,
    })
    expect(result.bucket).toBe('critical')
    expect(result.score).toBeLessThan(40)
  })

  it("retourne trend='unknown' en V1", () => {
    const result = computeHealthScore(baseInput)
    expect(result.trend).toBe('unknown')
  })

  it('renvoie un score entier (Math.round)', () => {
    const result = computeHealthScore(baseInput)
    expect(Number.isInteger(result.score)).toBe(true)
  })

  it('clampe le score final entre 0 et 100', () => {
    const min = computeHealthScore({
      logins_last_30d: 0,
      missions_completed_last_30d: 0,
      features_used_last_30d_count: 0,
      cross_check_avg_score: 0,
      sentiment_avg_last_30d: -1,
      payment_status: 'canceled',
      failed_payments_last_90d: 0,
      tenure_months: 0,
    })
    expect(min.score).toBeGreaterThanOrEqual(0)
    expect(min.score).toBeLessThanOrEqual(100)

    const max = computeHealthScore({
      logins_last_30d: 100,
      missions_completed_last_30d: 100,
      features_used_last_30d_count: 12,
      cross_check_avg_score: 100,
      sentiment_avg_last_30d: 1,
      payment_status: 'active',
      failed_payments_last_90d: 0,
      tenure_months: 24,
    })
    expect(max.score).toBeLessThanOrEqual(100)
    expect(max.score).toBeGreaterThan(95)
  })
})

describe('computeHealthScore — human_message', () => {
  it('contient le label FR du bucket + score + dimensions engagement & adoption', () => {
    const result = computeHealthScore(baseInput)
    expect(result.human_message).toContain('/100')
    expect(result.human_message).toContain('engagement')
    expect(result.human_message).toContain('adoption')
  })

  it("affiche 'Health critique' pour critical", () => {
    const result = computeHealthScore({
      logins_last_30d: 0,
      missions_completed_last_30d: 0,
      features_used_last_30d_count: 0,
      cross_check_avg_score: 10,
      sentiment_avg_last_30d: -0.9,
      payment_status: 'past_due',
      failed_payments_last_90d: 3,
      tenure_months: 1,
    })
    expect(result.human_message).toContain('Health critique')
  })

  it("affiche 'Health excellent' pour promoter", () => {
    const result = computeHealthScore({
      logins_last_30d: 30,
      missions_completed_last_30d: 40,
      features_used_last_30d_count: 11,
      cross_check_avg_score: 95,
      sentiment_avg_last_30d: 0.95,
      payment_status: 'active',
      failed_payments_last_90d: 0,
      tenure_months: 18,
    })
    expect(result.human_message).toContain('Health excellent')
  })
})
