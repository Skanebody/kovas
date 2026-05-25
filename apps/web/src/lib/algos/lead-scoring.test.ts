/**
 * Vitest — Algo A1.3.5 lead-scoring + Thompson sampling.
 */

import { describe, expect, it } from 'vitest'
import { type LeadScoringInput, scoreLeadIntent, thompsonSampleBeta } from './lead-scoring'

function baseInput(overrides: Partial<LeadScoringInput> = {}): LeadScoringInput {
  return {
    property_situation: 'vente',
    property_type: 'maison',
    property_surface_m2: 120,
    property_postal_code: '75008',
    property_year_built: 1945,
    diagnostics_requested: ['DPE', 'AMIANTE', 'PLOMB', 'ERP', 'CARREZ'],
    diagnostics_suggested_count: 2,
    requester_email: 'jean.dupont@notaires.fr',
    has_phone: true,
    has_message: true,
    honeypot_filled: false,
    recaptcha_score: 0.9,
    ...overrides,
  }
}

describe('scoreLeadIntent', () => {
  it('returns spam bucket for honeypot-filled requests', () => {
    const res = scoreLeadIntent(baseInput({ honeypot_filled: true }))
    expect(res.bucket).toBe('spam')
    expect(res.exclude_from_routing).toBe(true)
    expect(res.recommended_channel).toBe('skip')
  })

  it('returns spam bucket for low reCAPTCHA score', () => {
    const res = scoreLeadIntent(baseInput({ recaptcha_score: 0.1 }))
    expect(res.bucket).toBe('spam')
    expect(res.exclude_from_routing).toBe(true)
  })

  it('scores a premium lead high', () => {
    const res = scoreLeadIntent(baseInput())
    expect(res.intent_score).toBeGreaterThanOrEqual(75)
    expect(res.bucket).toBe('premium')
    expect(res.recommended_channel).toBe('sms_immediate')
    expect(res.exclude_from_routing).toBe(false)
  })

  it('scores a low-intent location request lower than a vente', () => {
    const venteScore = scoreLeadIntent(baseInput()).intent_score
    const locationScore = scoreLeadIntent(
      baseInput({
        property_situation: 'location',
        property_type: 'appartement',
        property_year_built: 2015,
        diagnostics_requested: ['DPE'],
        requester_email: 'particulier@gmail.com',
        has_phone: false,
        has_message: false,
      }),
    ).intent_score
    expect(locationScore).toBeLessThan(venteScore)
  })

  it('detects pro email domain (notaires.fr) for +10 bonus', () => {
    const proResult = scoreLeadIntent(baseInput({ requester_email: 'a@notaires.fr' }))
    const particulierResult = scoreLeadIntent(baseInput({ requester_email: 'a@gmail.com' }))
    const proSignal = proResult.signals.find((s) => s.code === 'EMAIL_PRO')
    const particulierSignal = particulierResult.signals.find((s) => s.code === 'EMAIL_PRO')
    expect(proSignal?.points).toBe(10)
    expect(particulierSignal?.points).toBe(0)
  })

  it('detects urbain bonus for 75 postcode', () => {
    const parisResult = scoreLeadIntent(baseInput({ property_postal_code: '75008' }))
    // 89 = Yonne (rural, pas dans URBAN_PREFIXES)
    const ruralResult = scoreLeadIntent(baseInput({ property_postal_code: '89000' }))
    const parisSignal = parisResult.signals.find((s) => s.code === 'URBAN')
    expect(parisSignal?.points).toBe(5)
    const ruralSignal = ruralResult.signals.find((s) => s.code === 'RURAL')
    expect(ruralSignal?.points).toBe(0)
  })

  it('flags pre-1949 with full ancient bonus', () => {
    const res = scoreLeadIntent(baseInput({ property_year_built: 1900 }))
    const yearSignal = res.signals.find((s) => s.code === 'YEAR')
    expect(yearSignal?.points).toBe(10)
  })

  it('handles null fields and lowers confidence', () => {
    const res = scoreLeadIntent(
      baseInput({
        property_surface_m2: null,
        property_year_built: null,
        property_postal_code: null,
      }),
    )
    expect(res.confidence).toBeLessThan(1)
    expect(res.confidence).toBeGreaterThanOrEqual(0.6)
  })
})

describe('thompsonSampleBeta', () => {
  it('returns a value in [0, 1]', () => {
    for (let i = 0; i < 50; i++) {
      const x = thompsonSampleBeta(2, 5)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThanOrEqual(1)
    }
  })

  it('tends to higher values when alpha >> beta', () => {
    // Beta(10, 1) has mean ≈ 10/11 ≈ 0.91
    const samples = Array.from({ length: 200 }, () => thompsonSampleBeta(10, 1))
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length
    expect(avg).toBeGreaterThan(0.7)
  })

  it('tends to lower values when beta >> alpha', () => {
    // Beta(1, 10) has mean ≈ 1/11 ≈ 0.09
    const samples = Array.from({ length: 200 }, () => thompsonSampleBeta(1, 10))
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length
    expect(avg).toBeLessThan(0.3)
  })
})
