import { describe, expect, it } from 'vitest'
import { type UpsellTimingInput, predictUpsellTiming } from './upsell-timing'

const baseInput: UpsellTimingInput = {
  tenure_months: 4,
  quota_usage_trend: 'increasing',
  quota_usage_pct: 75,
  recent_satisfaction_score: 8,
  recent_health_score: 75,
  recent_churn_score: 10,
  has_seen_similar_offer: false,
  days_since_last_offer: null,
  current_workload: 'medium',
  onboarding_completed: true,
  subscription_active: true,
}

describe('predictUpsellTiming', () => {
  it("recommande 'offer' pour un user idéal (quota en hausse, health haut, sweet spot tenure)", () => {
    const result = predictUpsellTiming(baseInput)
    expect(result.recommendation).toBe('offer')
    expect(result.score).toBeGreaterThanOrEqual(60)
    expect(result.confidence).toBe(1)
  })

  it("force 'skip' si subscription inactive même si tous les autres signaux sont verts", () => {
    const result = predictUpsellTiming({ ...baseInput, subscription_active: false })
    expect(result.recommendation).toBe('skip')
    expect(result.score).toBe(0)
    expect(result.signals).toHaveLength(1)
    expect(result.signals[0]?.code).toBe('subscription_inactive')
  })

  it("force 'skip' si churn critique (>= 70) — short-circuit retention", () => {
    const result = predictUpsellTiming({ ...baseInput, recent_churn_score: 75 })
    expect(result.recommendation).toBe('skip')
    expect(result.score).toBe(0)
    expect(result.signals.find((s) => s.code === 'churn_critical')).toBeDefined()
    expect(result.human_message).toContain('retention')
  })

  it('scoring normal si churn élevé mais <70 (50-69)', () => {
    const result = predictUpsellTiming({ ...baseInput, recent_churn_score: 55 })
    // Pas de short-circuit, signal churn_risk présent avec -40 pts
    expect(result.signals.find((s) => s.code === 'churn_risk')?.points).toBe(-40)
  })

  it("recommande 'wait' si offre similaire récente (cooldown <7j)", () => {
    const result = predictUpsellTiming({
      ...baseInput,
      has_seen_similar_offer: true,
      days_since_last_offer: 3,
    })
    expect(result.recommendation).toBe('wait')
    const cooldown = result.signals.find((s) => s.code === 'recent_offer')
    expect(cooldown?.points).toBe(-60)
  })

  it("recommande 'skip' si health score < 40 + onboarding non terminé", () => {
    const result = predictUpsellTiming({
      ...baseInput,
      recent_health_score: 30,
      onboarding_completed: false,
    })
    expect(result.recommendation).toBe('skip')
  })

  it('bonus +35 si quota >= 80% en hausse (vs +30 normal)', () => {
    const a = predictUpsellTiming({ ...baseInput, quota_usage_pct: 50 })
    const b = predictUpsellTiming({ ...baseInput, quota_usage_pct: 85 })
    const ptsA = a.signals.find((s) => s.code === 'quota_trend')?.points
    const ptsB = b.signals.find((s) => s.code === 'quota_trend')?.points
    expect(ptsB).toBeGreaterThan(ptsA ?? 0)
  })

  it('pénalise tenure < 1 mois (-20 points)', () => {
    const result = predictUpsellTiming({ ...baseInput, tenure_months: 0 })
    const tenureSig = result.signals.find((s) => s.code === 'tenure')
    expect(tenureSig?.points).toBe(-20)
  })

  it('récompense low workload (+10)', () => {
    const result = predictUpsellTiming({ ...baseInput, current_workload: 'low' })
    const workSig = result.signals.find((s) => s.code === 'workload')
    expect(workSig?.points).toBe(10)
  })

  it('pénalise high workload (-10)', () => {
    const result = predictUpsellTiming({ ...baseInput, current_workload: 'high' })
    const workSig = result.signals.find((s) => s.code === 'workload')
    expect(workSig?.points).toBe(-10)
  })

  it('confidence = 0.75 si 1 champ optionnel manquant sur 4', () => {
    const result = predictUpsellTiming({ ...baseInput, recent_satisfaction_score: null })
    expect(result.confidence).toBeCloseTo(0.75, 2)
  })

  it("recommande 'offer' avec quota stable + bonne santé + tenure mature", () => {
    const result = predictUpsellTiming({
      ...baseInput,
      quota_usage_trend: 'stable',
      tenure_months: 18,
      recent_health_score: 80,
    })
    // Score : quota 5 + health 25 + sat 20 + tenure 5 + work 5 + churn 5 + offer 0 + ob 0 = 65
    expect(result.recommendation).toBe('offer')
    expect(result.score).toBeGreaterThanOrEqual(60)
  })

  it('score clampé à 100 max même avec signaux supérieurs', () => {
    const result = predictUpsellTiming({
      ...baseInput,
      quota_usage_pct: 95,
      recent_satisfaction_score: 10,
      recent_health_score: 95,
      current_workload: 'low',
      recent_churn_score: 0,
    })
    expect(result.score).toBeLessThanOrEqual(100)
  })

  it('score clampé à 0 min même avec signaux négatifs cumulés', () => {
    const result = predictUpsellTiming({
      ...baseInput,
      quota_usage_trend: 'decreasing',
      recent_satisfaction_score: 2,
      recent_health_score: 20,
      recent_churn_score: 80,
      has_seen_similar_offer: true,
      days_since_last_offer: 2,
      onboarding_completed: false,
    })
    expect(result.score).toBeGreaterThanOrEqual(0)
    expect(result.recommendation).toBe('skip')
  })

  it('human_message contient le score', () => {
    const result = predictUpsellTiming(baseInput)
    expect(result.human_message).toContain(String(result.score))
  })
})
