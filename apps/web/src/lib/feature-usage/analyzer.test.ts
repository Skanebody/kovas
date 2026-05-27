import { describe, expect, it } from 'vitest'
import { type FeatureUsageStats, analyzeAllFeatures, analyzeFeatureUsage } from './analyzer'
import { FEATURES_CATALOG, type FeatureDefinition, getFeature } from './features-catalog'

const VOICE = getFeature('voice_capture') as FeatureDefinition
const ANALYTICS = getFeature('analytics') as FeatureDefinition
const INTEGRATIONS = getFeature('integrations_pdp') as FeatureDefinition

function makeStats(overrides: Partial<FeatureUsageStats> = {}): FeatureUsageStats {
  return {
    feature_id: 'voice_capture',
    period_days: 30,
    active_users_count: 100,
    total_users_count: 200,
    total_uses_count: 1500,
    avg_uses_per_active_user: 15,
    median_uses_per_active_user: 12,
    ...overrides,
  }
}

describe('analyzeFeatureUsage — buckets', () => {
  it('bucket=dead si adoption_pct < 2%', () => {
    const stats = makeStats({ active_users_count: 2, total_users_count: 200 })
    const result = analyzeFeatureUsage(stats, VOICE)
    expect(result.bucket).toBe('dead')
    expect(result.adoption_pct).toBe(1)
  })

  it('bucket=underused si 2% <= adoption_pct < 30%', () => {
    const stats = makeStats({ active_users_count: 50, total_users_count: 200 })
    const result = analyzeFeatureUsage(stats, VOICE)
    expect(result.bucket).toBe('underused')
    expect(result.adoption_pct).toBe(25)
  })

  it('bucket=mainstream si 30% <= adoption_pct < 70%', () => {
    const stats = makeStats({ active_users_count: 100, total_users_count: 200 })
    const result = analyzeFeatureUsage(stats, VOICE)
    expect(result.bucket).toBe('mainstream')
    expect(result.adoption_pct).toBe(50)
  })

  it('bucket=power si adoption_pct >= 70%', () => {
    const stats = makeStats({ active_users_count: 160, total_users_count: 200 })
    const result = analyzeFeatureUsage(stats, VOICE)
    expect(result.bucket).toBe('power')
    expect(result.adoption_pct).toBe(80)
  })

  it('bucket frontière exactement 2% est underused (pas dead)', () => {
    const stats = makeStats({ active_users_count: 4, total_users_count: 200 })
    const result = analyzeFeatureUsage(stats, VOICE)
    expect(result.adoption_pct).toBe(2)
    expect(result.bucket).toBe('underused')
  })

  it('bucket frontière exactement 70% est power (pas mainstream)', () => {
    const stats = makeStats({ active_users_count: 140, total_users_count: 200 })
    const result = analyzeFeatureUsage(stats, VOICE)
    expect(result.adoption_pct).toBe(70)
    expect(result.bucket).toBe('power')
  })
})

describe('analyzeFeatureUsage — recommended_action overrides', () => {
  it("dead + impact=core → 'investigate' (jamais 'kill' sur core)", () => {
    const stats = makeStats({ active_users_count: 2, total_users_count: 200 })
    const result = analyzeFeatureUsage(stats, VOICE) // core
    expect(result.bucket).toBe('dead')
    expect(result.recommended_action).toBe('investigate')
  })

  it("dead + impact=low → 'kill' (autorisé pour features low)", () => {
    const stats = makeStats({
      feature_id: 'integrations_pdp',
      active_users_count: 1,
      total_users_count: 200,
    })
    const result = analyzeFeatureUsage(stats, INTEGRATIONS) // low
    expect(result.bucket).toBe('dead')
    expect(result.recommended_action).toBe('kill')
  })

  it("underused + impact=core → 'promote'", () => {
    const stats = makeStats({ active_users_count: 30, total_users_count: 200 })
    const result = analyzeFeatureUsage(stats, VOICE)
    expect(result.bucket).toBe('underused')
    expect(result.recommended_action).toBe('promote')
  })

  it("underused + impact=low → 'investigate' (vraiment utile ?)", () => {
    const stats = makeStats({
      feature_id: 'integrations_pdp',
      active_users_count: 30,
      total_users_count: 200,
    })
    const result = analyzeFeatureUsage(stats, INTEGRATIONS)
    expect(result.bucket).toBe('underused')
    expect(result.recommended_action).toBe('investigate')
  })

  it("mainstream → 'maintain'", () => {
    const stats = makeStats({ active_users_count: 100, total_users_count: 200 })
    const result = analyzeFeatureUsage(stats, VOICE)
    expect(result.recommended_action).toBe('maintain')
  })

  it("power → 'amplify'", () => {
    const stats = makeStats({ active_users_count: 160, total_users_count: 200 })
    const result = analyzeFeatureUsage(stats, VOICE)
    expect(result.recommended_action).toBe('amplify')
  })
})

describe('analyzeFeatureUsage — status', () => {
  it('status=critical si dead + impact=core', () => {
    const stats = makeStats({ active_users_count: 2, total_users_count: 200 })
    const result = analyzeFeatureUsage(stats, VOICE) // core
    expect(result.status).toBe('critical')
    expect(result.signals.some((s) => s.code === 'core_feature_dead')).toBe(true)
  })

  it('status=warning si vs_expected < 0.5 (sous-perform fort)', () => {
    // VOICE expected_adoption_pct=80%. À 30% adoption → vs_expected=0.375 < 0.5
    const stats = makeStats({ active_users_count: 60, total_users_count: 200 })
    const result = analyzeFeatureUsage(stats, VOICE)
    expect(result.adoption_pct).toBe(30)
    expect(result.vs_expected).toBeLessThan(0.5)
    expect(result.status).toBe('warning')
  })

  it('status=over_performing si vs_expected > 1.5', () => {
    // ANALYTICS expected=30%. À 60% adoption → vs_expected=2.0 > 1.5
    const stats = makeStats({
      feature_id: 'analytics',
      active_users_count: 120,
      total_users_count: 200,
    })
    const result = analyzeFeatureUsage(stats, ANALYTICS)
    expect(result.vs_expected).toBe(2)
    expect(result.status).toBe('over_performing')
  })

  it('status=healthy si vs_expected entre 0.5 et 1.5 et pas dead+core', () => {
    // VOICE expected=80%. À 70% adoption → vs_expected=0.875
    const stats = makeStats({ active_users_count: 140, total_users_count: 200 })
    const result = analyzeFeatureUsage(stats, VOICE)
    expect(result.status).toBe('healthy')
  })
})

describe('analyzeFeatureUsage — adoption_rate / signals / human_message', () => {
  it('adoption_rate = active / total exactement', () => {
    const stats = makeStats({ active_users_count: 75, total_users_count: 200 })
    const result = analyzeFeatureUsage(stats, VOICE)
    expect(result.adoption_rate).toBe(0.375)
    expect(result.adoption_pct).toBe(37.5)
  })

  it('adoption_rate = 0 si total_users_count = 0 (pas de division par zéro)', () => {
    const stats = makeStats({ active_users_count: 0, total_users_count: 0 })
    const result = analyzeFeatureUsage(stats, VOICE)
    expect(result.adoption_rate).toBe(0)
    expect(result.adoption_pct).toBe(0)
    expect(result.bucket).toBe('dead')
  })

  it('vs_expected = 0 si expected_adoption_pct=0 (cas théorique)', () => {
    const customFeature: FeatureDefinition = {
      ...VOICE,
      expected_adoption_pct: 0,
    }
    const stats = makeStats({ active_users_count: 50, total_users_count: 200 })
    const result = analyzeFeatureUsage(stats, customFeature)
    expect(result.vs_expected).toBe(0)
  })

  it('signals contient toujours bucket_*', () => {
    const stats = makeStats({ active_users_count: 100, total_users_count: 200 })
    const result = analyzeFeatureUsage(stats, VOICE)
    expect(result.signals.some((s) => s.code.startsWith('bucket_'))).toBe(true)
  })

  it("signals inclut 'high_intensity' si avg_uses_per_active_user >= 10", () => {
    const stats = makeStats({
      active_users_count: 100,
      total_users_count: 200,
      avg_uses_per_active_user: 16,
    })
    const result = analyzeFeatureUsage(stats, VOICE)
    expect(result.signals.some((s) => s.code === 'high_intensity')).toBe(true)
  })

  it("signals N'inclut PAS 'high_intensity' si avg < 10", () => {
    const stats = makeStats({
      active_users_count: 100,
      total_users_count: 200,
      avg_uses_per_active_user: 5,
    })
    const result = analyzeFeatureUsage(stats, VOICE)
    expect(result.signals.some((s) => s.code === 'high_intensity')).toBe(false)
  })

  it("signals 'underperform_vs_expected' apparaît si vs_expected < 0.5", () => {
    const stats = makeStats({ active_users_count: 60, total_users_count: 200 })
    const result = analyzeFeatureUsage(stats, VOICE)
    expect(result.signals.some((s) => s.code === 'underperform_vs_expected')).toBe(true)
  })

  it("signals 'overperform_vs_expected' apparaît si vs_expected > 1.5", () => {
    const stats = makeStats({
      feature_id: 'analytics',
      active_users_count: 120,
      total_users_count: 200,
    })
    const result = analyzeFeatureUsage(stats, ANALYTICS)
    expect(result.signals.some((s) => s.code === 'overperform_vs_expected')).toBe(true)
  })

  it('human_message contient le nom display + adoption_pct + bucket + action', () => {
    const stats = makeStats({ active_users_count: 160, total_users_count: 200 })
    const result = analyzeFeatureUsage(stats, VOICE)
    expect(result.human_message).toContain(VOICE.display_name)
    expect(result.human_message).toContain('80.0%')
    expect(result.human_message).toContain('power')
    expect(result.human_message).toContain('amplifier')
  })
})

describe('analyzeAllFeatures', () => {
  it('produit une analyse par feature passée', () => {
    const stats: FeatureUsageStats[] = [
      makeStats({ feature_id: 'voice_capture', active_users_count: 160 }),
      makeStats({ feature_id: 'analytics', active_users_count: 50 }),
    ]
    const results = analyzeAllFeatures(stats, FEATURES_CATALOG)
    expect(results).toHaveLength(2)
    expect(results.map((r) => r.feature_id).sort()).toEqual(['analytics', 'voice_capture'])
  })

  it("ignore silencieusement les stats dont la feature n'est pas dans le catalog", () => {
    const stats: FeatureUsageStats[] = [
      makeStats({ feature_id: 'voice_capture' }),
      makeStats({ feature_id: 'ghost_feature' as never }),
    ]
    const results = analyzeAllFeatures(stats, FEATURES_CATALOG)
    expect(results).toHaveLength(1)
  })

  it('retourne tableau vide si aucune stats passée', () => {
    expect(analyzeAllFeatures([], FEATURES_CATALOG)).toEqual([])
  })
})
