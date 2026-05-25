/**
 * Vitest — Algo A1.3.11 churn predictor.
 */

import { describe, expect, it } from 'vitest'
import { type ChurnInput, predictChurnRisk } from './churn-predictor'

function baseInput(overrides: Partial<ChurnInput> = {}): ChurnInput {
  return {
    subscription_status: 'active',
    days_since_last_login: 5,
    activity_score: 0.7,
    activity_score_30d_ago: 0.7,
    worst_cert_urgency: 'safe',
    quota_usage_pct: 60,
    cancellation_initiated: false,
    trial_ends_in_days: null,
    support_tickets_open: 0,
    ...overrides,
  }
}

describe('predictChurnRisk', () => {
  it('returns low bucket for healthy active subscriber', () => {
    const res = predictChurnRisk(baseInput())
    expect(res.bucket).toBe('low')
    expect(res.churn_risk_score).toBeLessThan(25)
    expect(res.recommended_action).toBe('monitor')
  })

  it('returns critical bucket for canceled + cancellation + expired cert + inactive', () => {
    const res = predictChurnRisk(
      baseInput({
        subscription_status: 'canceled',
        cancellation_initiated: true,
        worst_cert_urgency: 'expired',
        days_since_last_login: 70,
        activity_score: 0.1,
        activity_score_30d_ago: 0.6,
        quota_usage_pct: 3,
      }),
    )
    expect(res.bucket).toBe('critical')
    expect(res.recommended_action).toBe('winback_offer')
    expect(res.churn_risk_score).toBeGreaterThanOrEqual(70)
  })

  it('detects activity drop as warning signal', () => {
    const res = predictChurnRisk(baseInput({ activity_score: 0.2, activity_score_30d_ago: 0.7 }))
    const trendSignal = res.signals.find((s) => s.code === 'ACTIVITY_TREND')
    // Drop = 0.5 → >= 0.4 → 15 pts
    expect(trendSignal?.points).toBe(15)
  })

  it('boosts churn for unpaid + inactive login', () => {
    const res = predictChurnRisk(
      baseInput({ subscription_status: 'unpaid', days_since_last_login: 65 }),
    )
    expect(res.churn_risk_score).toBeGreaterThanOrEqual(25)
  })

  it('handles trial ending soon as a contributing signal', () => {
    const res = predictChurnRisk(
      baseInput({ subscription_status: 'trialing', trial_ends_in_days: 2 }),
    )
    const trial = res.signals.find((s) => s.code === 'TRIAL_END')
    expect(trial?.points).toBe(5)
  })

  it('returns confidence < 1 when nulls present', () => {
    const res = predictChurnRisk(
      baseInput({ days_since_last_login: null, activity_score: null, quota_usage_pct: null }),
    )
    expect(res.confidence).toBeLessThan(1)
    expect(res.confidence).toBeGreaterThanOrEqual(0.6)
  })

  it('escalates action with bucket : monitor → email_check → personal_call → winback', () => {
    const monitor = predictChurnRisk(baseInput())
    expect(monitor.recommended_action).toBe('monitor')

    // mid bucket needs >= 25 pts : login 40d (10) + cancellation_initiated (20) = 30
    const emailCheck = predictChurnRisk(
      baseInput({
        days_since_last_login: 40,
        cancellation_initiated: true,
      }),
    )
    expect(['email_check', 'personal_call']).toContain(emailCheck.recommended_action)
  })
})
