import { describe, expect, it } from 'vitest'
import { type LtvForecastInput, forecastLtv } from './ltv-forecasting'

const baseSolo: LtvForecastInput = {
  initial_tier: 'solo',
  annual_commitment: false,
  onboarding_completed_d7: false,
  activated_d7: false,
  initial_addons_count: 0,
  source: 'direct',
  referrer_d30: false,
  siret_verified: false,
}

describe('forecastLtv', () => {
  it('Solo baseline (mensuel direct, no activation) → ~244 € (29×24×0.35)', () => {
    const result = forecastLtv(baseSolo)
    expect(result.ltv_eur).toBe(244)
    expect(result.segment).toBe('low')
    expect(result.max_cac_eur).toBeLessThan(80) // 244/3.3 ≈ 74
  })

  it('Pro baseline → ~948 € (79×24×0.5)', () => {
    const result = forecastLtv({ ...baseSolo, initial_tier: 'pro' })
    expect(result.ltv_eur).toBe(948)
    expect(result.segment).toBe('mid')
  })

  it('Cabinet baseline → ~2866 € (199×24×0.6)', () => {
    const result = forecastLtv({ ...baseSolo, initial_tier: 'cabinet' })
    expect(result.ltv_eur).toBe(2866)
    expect(result.segment).toBe('high')
  })

  it('Cabinet+ baseline → ~8383 € (499×24×0.7) → segment vip', () => {
    const result = forecastLtv({ ...baseSolo, initial_tier: 'cabinet_plus' })
    expect(result.ltv_eur).toBe(8383)
    expect(result.segment).toBe('vip')
  })

  it('Enterprise baseline → ~28800 € (1500×24×0.8) → segment vip', () => {
    const result = forecastLtv({ ...baseSolo, initial_tier: 'enterprise' })
    expect(result.ltv_eur).toBe(28800)
    expect(result.segment).toBe('vip')
  })

  it('Pro + activation D7 + onboarding + annual + référé + 1 addon + SIRET → multiplie ~3×', () => {
    const result = forecastLtv({
      initial_tier: 'pro',
      annual_commitment: true,
      onboarding_completed_d7: true,
      activated_d7: true,
      initial_addons_count: 1,
      source: 'referral',
      referrer_d30: false,
      siret_verified: true,
    })
    // 948 × 1.15 × 1.20 × 1.50 × 1.30 × 1.40 × 1.00 × 1.10 ≈ 3922
    expect(result.ltv_eur).toBeGreaterThan(3500)
    expect(result.ltv_eur).toBeLessThan(4500)
    expect(result.segment).toBe('high')
  })

  it('activation D7 contribue +50% (multiplier 1.5)', () => {
    const a = forecastLtv({ ...baseSolo, initial_tier: 'pro', activated_d7: false })
    const b = forecastLtv({ ...baseSolo, initial_tier: 'pro', activated_d7: true })
    expect(b.ltv_eur / a.ltv_eur).toBeCloseTo(1.5, 1)
  })

  it('paid_ads pénalise -15% (multiplier 0.85)', () => {
    const a = forecastLtv({ ...baseSolo, initial_tier: 'pro', source: 'direct' })
    const b = forecastLtv({ ...baseSolo, initial_tier: 'pro', source: 'paid_ads' })
    expect(b.ltv_eur / a.ltv_eur).toBeCloseTo(0.85, 1)
  })

  it('addons multiplier capé à ×1.60 (3 addons ne dépasse pas)', () => {
    const a = forecastLtv({ ...baseSolo, initial_addons_count: 2 })
    const b = forecastLtv({ ...baseSolo, initial_addons_count: 5 })
    const addonMultA = a.signals.find((s) => s.code === 'addons')?.multiplier ?? 0
    const addonMultB = b.signals.find((s) => s.code === 'addons')?.multiplier ?? 0
    expect(addonMultA).toBe(1.6)
    expect(addonMultB).toBe(1.6) // capé
  })

  it('CAC max = LTV / 3.3 (cible LTV/CAC ≥ 3,3)', () => {
    const result = forecastLtv({ ...baseSolo, initial_tier: 'pro' })
    expect(result.max_cac_eur).toBeCloseTo(result.ltv_eur / 3.3, 0)
  })

  it('human_message contient le segment et le LTV', () => {
    const result = forecastLtv({ ...baseSolo, initial_tier: 'cabinet' })
    expect(result.human_message).toContain('High LTV')
    expect(result.human_message).toContain('2866')
  })

  it('signals retourne 7 multipliers (annual, ob_d7, act_d7, addons, source, ref_d30, siret)', () => {
    const result = forecastLtv(baseSolo)
    expect(result.signals).toHaveLength(7)
    const codes = result.signals.map((s) => s.code)
    expect(codes).toEqual([
      'annual',
      'onboarding_d7',
      'activation_d7',
      'addons',
      'source',
      'referrer_d30',
      'siret',
    ])
  })

  it('segmentation par seuils 500 / 1500 / 5000 €', () => {
    expect(forecastLtv({ ...baseSolo }).segment).toBe('low') // 244 €
    expect(forecastLtv({ ...baseSolo, initial_tier: 'pro' }).segment).toBe('mid') // 948 €
    expect(forecastLtv({ ...baseSolo, initial_tier: 'cabinet' }).segment).toBe('high') // 2866 €
    expect(forecastLtv({ ...baseSolo, initial_tier: 'cabinet_plus' }).segment).toBe('vip') // 8383 €
  })
})
