import { describe, expect, it } from 'vitest'
import { type UserSignals, rankOpportunities, scoreOpportunity } from './opportunity-scorer'
import type { UpsellOpportunity } from './triggers'

const baseTierOp: UpsellOpportunity = {
  trigger_code: 'quota_80',
  type: 'tier_upgrade',
  from_tier: 'solo',
  to_tier: 'pro',
  reason: 'Test reason',
  base_revenue_potential_eur: 50,
}

const baseAddonOp: UpsellOpportunity = {
  trigger_code: 'addon_pipeline_mpr',
  type: 'addon',
  addon: 'pipeline_maprimerenov',
  reason: 'Test reason',
  base_revenue_potential_eur: 19,
}

const baseAnnualOp: UpsellOpportunity = {
  trigger_code: 'annual_commitment',
  type: 'annual_commitment',
  from_tier: 'pro',
  reason: 'Test reason',
  base_revenue_potential_eur: 40,
}

const baseSignals: UserSignals = {
  upsell_timing_score: 50,
  health_score: 60,
  tenure_months: 6,
  cluster: 'occasional_solo',
}

describe('scoreOpportunity', () => {
  it('utilise la baseline prob tier_upgrade = 0.08', () => {
    const scored = scoreOpportunity(baseTierOp, {
      ...baseSignals,
      upsell_timing_score: 0,
      health_score: 0,
      tenure_months: 20, // ni sweet spot ni saturation
      cluster: 'new_user',
    })
    // Pas de modifier appliqué → prob ≈ 0.08
    expect(scored.estimated_conversion_prob).toBeCloseTo(0.08, 2)
  })

  it('utilise la baseline prob addon = 0.05', () => {
    const scored = scoreOpportunity(baseAddonOp, {
      ...baseSignals,
      upsell_timing_score: 0,
      health_score: 0,
      tenure_months: 20,
      cluster: 'new_user',
    })
    expect(scored.estimated_conversion_prob).toBeCloseTo(0.05, 2)
  })

  it('utilise la baseline prob annual_commitment = 0.12', () => {
    const scored = scoreOpportunity(baseAnnualOp, {
      ...baseSignals,
      upsell_timing_score: 0,
      health_score: 0,
      tenure_months: 20,
      cluster: 'new_user',
    })
    expect(scored.estimated_conversion_prob).toBeCloseTo(0.12, 2)
  })

  it('applique × 1.5 si upsell_timing_score >= 70', () => {
    const low = scoreOpportunity(baseTierOp, { ...baseSignals, upsell_timing_score: 50 })
    const high = scoreOpportunity(baseTierOp, { ...baseSignals, upsell_timing_score: 75 })
    expect(high.estimated_conversion_prob).toBeGreaterThan(low.estimated_conversion_prob)
  })

  it('applique × 1.3 si health_score >= 70', () => {
    const low = scoreOpportunity(baseTierOp, { ...baseSignals, health_score: 60 })
    const high = scoreOpportunity(baseTierOp, { ...baseSignals, health_score: 80 })
    expect(high.estimated_conversion_prob).toBeGreaterThan(low.estimated_conversion_prob)
  })

  it('applique × 1.2 pour tenure dans [3, 18] sweet spot', () => {
    const sweet = scoreOpportunity(baseTierOp, {
      ...baseSignals,
      tenure_months: 6,
      upsell_timing_score: 0,
      health_score: 0,
      cluster: 'new_user',
    })
    const outside = scoreOpportunity(baseTierOp, {
      ...baseSignals,
      tenure_months: 20,
      upsell_timing_score: 0,
      health_score: 0,
      cluster: 'new_user',
    })
    expect(sweet.estimated_conversion_prob).toBeGreaterThan(outside.estimated_conversion_prob)
  })

  it('applique × 0.7 pour tenure > 24 (saturation)', () => {
    const saturated = scoreOpportunity(baseTierOp, {
      ...baseSignals,
      tenure_months: 30,
      upsell_timing_score: 0,
      health_score: 0,
      cluster: 'new_user',
    })
    // 0.08 × 0.7 = 0.056
    expect(saturated.estimated_conversion_prob).toBeCloseTo(0.056, 2)
  })

  it('applique cap dur sur cluster churning (≤ baseline × 0.3)', () => {
    const churning = scoreOpportunity(baseTierOp, {
      ...baseSignals,
      cluster: 'churning',
      upsell_timing_score: 90,
      health_score: 85,
      tenure_months: 6,
    })
    // Cap = 0.08 × 0.3 = 0.024
    expect(churning.estimated_conversion_prob).toBeLessThanOrEqual(0.024)
  })

  it('cluster fit : power_user + tier_upgrade → +0.3', () => {
    const noFit = scoreOpportunity(baseTierOp, { ...baseSignals, cluster: 'new_user' })
    const withFit = scoreOpportunity(baseTierOp, { ...baseSignals, cluster: 'power_user' })
    expect(withFit.estimated_conversion_prob - noFit.estimated_conversion_prob).toBeGreaterThan(
      0.25,
    )
  })

  it('cluster fit : cabinet_team + annual_commitment → +0.4', () => {
    const noFit = scoreOpportunity(baseAnnualOp, { ...baseSignals, cluster: 'new_user' })
    const withFit = scoreOpportunity(baseAnnualOp, { ...baseSignals, cluster: 'cabinet_team' })
    expect(withFit.estimated_conversion_prob - noFit.estimated_conversion_prob).toBeGreaterThan(
      0.35,
    )
  })

  it('cluster fit : occasional_solo + pipeline_mpr → +0.2', () => {
    const noFit = scoreOpportunity(baseAddonOp, { ...baseSignals, cluster: 'new_user' })
    const withFit = scoreOpportunity(baseAddonOp, {
      ...baseSignals,
      cluster: 'occasional_solo',
    })
    expect(withFit.estimated_conversion_prob - noFit.estimated_conversion_prob).toBeGreaterThan(
      0.15,
    )
  })

  it('composite_score = prob × revenue × 10 (clamp 0-100)', () => {
    const scored = scoreOpportunity(baseTierOp, baseSignals)
    const expected = scored.estimated_conversion_prob * baseTierOp.base_revenue_potential_eur * 10
    expect(scored.composite_score).toBeCloseTo(Math.min(100, expected), 1)
  })

  it('composite_score clamp à 100 si prob × revenue × 10 > 100', () => {
    const bigOp: UpsellOpportunity = {
      ...baseTierOp,
      base_revenue_potential_eur: 1000,
    }
    const scored = scoreOpportunity(bigOp, {
      ...baseSignals,
      upsell_timing_score: 90,
      health_score: 90,
      cluster: 'power_user',
    })
    expect(scored.composite_score).toBeLessThanOrEqual(100)
  })

  it('confidence max (1.0) avec tous signaux dispos', () => {
    const scored = scoreOpportunity(baseTierOp, {
      upsell_timing_score: 50,
      health_score: 60,
      tenure_months: 6,
      cluster: 'occasional_solo',
    })
    expect(scored.confidence).toBe(1)
  })

  it('confidence réduite si health_score null', () => {
    const scored = scoreOpportunity(baseTierOp, {
      ...baseSignals,
      health_score: null,
    })
    expect(scored.confidence).toBeLessThan(1)
    // 0.3 (timing) + 0.2 (cluster) + 0.2 (tenure) = 0.7
    expect(scored.confidence).toBe(0.7)
  })

  it('confidence réduite si tenure_months = 0', () => {
    const scored = scoreOpportunity(baseTierOp, {
      ...baseSignals,
      tenure_months: 0,
    })
    expect(scored.confidence).toBe(0.8) // 0.3 + 0.3 + 0.2 = 0.8
  })

  it('prob clampée à [0, 1]', () => {
    const scored = scoreOpportunity(baseAnnualOp, {
      upsell_timing_score: 100,
      health_score: 100,
      tenure_months: 6,
      cluster: 'cabinet_team',
    })
    expect(scored.estimated_conversion_prob).toBeGreaterThanOrEqual(0)
    expect(scored.estimated_conversion_prob).toBeLessThanOrEqual(1)
  })
})

describe('rankOpportunities', () => {
  it('trie par composite_score desc', () => {
    const ops: UpsellOpportunity[] = [
      { ...baseAddonOp, trigger_code: 'low', base_revenue_potential_eur: 10 },
      { ...baseTierOp, trigger_code: 'mid', base_revenue_potential_eur: 50 },
      { ...baseTierOp, trigger_code: 'high', base_revenue_potential_eur: 300 },
    ]
    const ranked = rankOpportunities(ops, baseSignals)
    expect(ranked[0]?.trigger_code).toBe('high')
    expect(ranked[ranked.length - 1]?.trigger_code).toBe('low')
  })

  it('retourne array vide si pas d opportunities', () => {
    const ranked = rankOpportunities([], baseSignals)
    expect(ranked).toEqual([])
  })

  it('ordre desc strictement vérifié', () => {
    const ops: UpsellOpportunity[] = [
      { ...baseAddonOp, trigger_code: 'a', base_revenue_potential_eur: 15 },
      { ...baseAddonOp, trigger_code: 'b', base_revenue_potential_eur: 25 },
      { ...baseTierOp, trigger_code: 'c', base_revenue_potential_eur: 50 },
      { ...baseAnnualOp, trigger_code: 'd', base_revenue_potential_eur: 100 },
    ]
    const ranked = rankOpportunities(ops, baseSignals)
    for (let i = 1; i < ranked.length; i++) {
      const current = ranked[i]
      const prev = ranked[i - 1]
      if (current && prev) {
        expect(current.composite_score).toBeLessThanOrEqual(prev.composite_score)
      }
    }
  })
})
