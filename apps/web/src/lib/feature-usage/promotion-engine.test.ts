import { describe, expect, it } from 'vitest'
import type { FeatureAnalysis, RecommendedAction } from './analyzer'
import type { FeatureId } from './features-catalog'
import {
  type PromotionDecision,
  type PromotionTarget,
  decidePromotionForUser,
  rankPromotionDecisions,
} from './promotion-engine'
import type { RetentionUpliftResult, UpliftRecommendation } from './retention-uplift'

function makeAnalysis(
  feature_id: FeatureId,
  recommended_action: RecommendedAction,
): FeatureAnalysis {
  return {
    feature_id,
    adoption_rate: 0.2,
    adoption_pct: 20,
    bucket: 'underused',
    vs_expected: 0.4,
    status: 'warning',
    recommended_action,
    signals: [],
    human_message: '',
  }
}

function makeUplift(
  feature_id: FeatureId,
  recommendation: UpliftRecommendation,
): RetentionUpliftResult {
  return {
    feature_id,
    d30_uplift_pct: 15,
    d60_uplift_pct: 25,
    d90_uplift_pct: 30,
    statistical_confidence: recommendation === 'high_priority_promote' ? 'high' : 'medium',
    recommendation,
    human_message: '',
  }
}

function makeTarget(overrides: Partial<PromotionTarget> = {}): PromotionTarget {
  return {
    user_id: 'u1',
    cluster: 'occasional_solo',
    tenure_months: 2,
    current_tier: 'solo',
    features_used_30d: [],
    ...overrides,
  }
}

describe('decidePromotionForUser — filtres', () => {
  it('filtre les features déjà utilisées par le user', () => {
    const target = makeTarget({ features_used_30d: ['voice_capture'] })
    const analyses: FeatureAnalysis[] = [makeAnalysis('voice_capture', 'promote')]
    const uplifts: RetentionUpliftResult[] = [makeUplift('voice_capture', 'high_priority_promote')]
    const decision = decidePromotionForUser(target, analyses, uplifts)
    expect(decision.feature_to_promote).not.toBe('voice_capture')
  })

  it('filtre les features dont le tier user est insuffisant (analytics requires pro, user is solo)', () => {
    const target = makeTarget({ current_tier: 'solo' })
    const analyses: FeatureAnalysis[] = [makeAnalysis('analytics', 'promote')]
    const uplifts: RetentionUpliftResult[] = [makeUplift('analytics', 'high_priority_promote')]
    const decision = decidePromotionForUser(target, analyses, uplifts)
    expect(decision.feature_to_promote).toBeNull()
  })

  it('autorise pro user à recevoir promotion analytics (tier pro)', () => {
    const target = makeTarget({ current_tier: 'pro', cluster: 'cabinet_team' })
    const analyses: FeatureAnalysis[] = [makeAnalysis('analytics', 'promote')]
    const uplifts: RetentionUpliftResult[] = [makeUplift('analytics', 'high_priority_promote')]
    const decision = decidePromotionForUser(target, analyses, uplifts)
    expect(decision.feature_to_promote).toBe('analytics')
  })

  it("filtre les features dont l'analyzer ne recommande PAS 'promote'", () => {
    const target = makeTarget()
    const analyses: FeatureAnalysis[] = [
      makeAnalysis('voice_capture', 'maintain'),
      makeAnalysis('photo_geolocation', 'amplify'),
    ]
    const uplifts: RetentionUpliftResult[] = []
    const decision = decidePromotionForUser(target, analyses, uplifts)
    expect(decision.feature_to_promote).toBeNull()
  })

  it("filtre les features dont retention_uplift est 'no_action'", () => {
    const target = makeTarget()
    const analyses: FeatureAnalysis[] = [makeAnalysis('voice_capture', 'promote')]
    const uplifts: RetentionUpliftResult[] = [makeUplift('voice_capture', 'no_action')]
    const decision = decidePromotionForUser(target, analyses, uplifts)
    expect(decision.feature_to_promote).toBeNull()
  })

  it('autorise feature sans retention_uplift connue (uplift table peut être partielle)', () => {
    const target = makeTarget()
    const analyses: FeatureAnalysis[] = [makeAnalysis('voice_capture', 'promote')]
    const uplifts: RetentionUpliftResult[] = [] // pas d'uplift connu
    const decision = decidePromotionForUser(target, analyses, uplifts)
    expect(decision.feature_to_promote).toBe('voice_capture')
  })

  it("user 'enterprise' a accès à toutes les features (mapping vers cabinet_plus)", () => {
    const target = makeTarget({ current_tier: 'enterprise', cluster: 'cabinet_team' })
    const analyses: FeatureAnalysis[] = [makeAnalysis('integrations_pdp', 'promote')]
    const uplifts: RetentionUpliftResult[] = [makeUplift('integrations_pdp', 'consider_promote')]
    const decision = decidePromotionForUser(target, analyses, uplifts)
    expect(decision.feature_to_promote).toBe('integrations_pdp')
  })
})

describe('decidePromotionForUser — scoring', () => {
  it('priority_score inclut +50 pour high_priority_promote', () => {
    const target = makeTarget({ cluster: 'new_user', tenure_months: 2 })
    const analyses: FeatureAnalysis[] = [makeAnalysis('voice_capture', 'promote')]
    const uplifts: RetentionUpliftResult[] = [makeUplift('voice_capture', 'high_priority_promote')]
    const decision = decidePromotionForUser(target, analyses, uplifts)
    // 50 (uplift) + 20 (cluster fit new_user × voice_capture) + 10 (tenure idéal core M2)
    expect(decision.priority_score).toBe(80)
  })

  it('priority_score inclut +20 pour consider_promote', () => {
    const target = makeTarget({ cluster: 'occasional_solo', tenure_months: 2 })
    const analyses: FeatureAnalysis[] = [makeAnalysis('voice_capture', 'promote')]
    const uplifts: RetentionUpliftResult[] = [makeUplift('voice_capture', 'consider_promote')]
    const decision = decidePromotionForUser(target, analyses, uplifts)
    // 20 (uplift) + 20 (cluster fit) + 10 (tenure idéal)
    expect(decision.priority_score).toBe(50)
  })

  it("cluster='churning' applique -30 et tend vers no-op (filtre cluster_fit vide)", () => {
    const target = makeTarget({ cluster: 'churning' })
    const analyses: FeatureAnalysis[] = [makeAnalysis('voice_capture', 'promote')]
    const uplifts: RetentionUpliftResult[] = [makeUplift('voice_capture', 'consider_promote')]
    const decision = decidePromotionForUser(target, analyses, uplifts)
    // Score = clamp(20 uplift + 0 cluster + 10 tenure − 30 churning) = 0
    expect(decision.priority_score).toBe(0)
    expect(decision.feature_to_promote).toBe('voice_capture')
    // Mais reason doit mentionner que le score est bas, on attend que rankPromotionDecisions
    // garde quand même la décision (filtre nulls seulement)
  })

  it('tenure idéal +10 pour core feature en M1-M3', () => {
    const target = makeTarget({ cluster: 'new_user', tenure_months: 2 })
    const analyses: FeatureAnalysis[] = [makeAnalysis('voice_capture', 'promote')]
    const uplifts: RetentionUpliftResult[] = []
    const decision = decidePromotionForUser(target, analyses, uplifts)
    // 0 uplift + 20 cluster fit + 10 tenure = 30
    expect(decision.priority_score).toBe(30)
  })

  it('tenure idéal +10 pour advanced feature en M3+', () => {
    const target = makeTarget({ current_tier: 'pro', cluster: 'power_user', tenure_months: 5 })
    const analyses: FeatureAnalysis[] = [makeAnalysis('analytics', 'promote')]
    const uplifts: RetentionUpliftResult[] = []
    const decision = decidePromotionForUser(target, analyses, uplifts)
    // 0 uplift + 20 cluster fit power_user × analytics + 10 tenure idéal = 30
    expect(decision.priority_score).toBe(30)
  })

  it('tenure non idéal pas de +10 (core feature à M6 = trop tard pour onboarding push)', () => {
    const target = makeTarget({ cluster: 'occasional_solo', tenure_months: 6 })
    const analyses: FeatureAnalysis[] = [makeAnalysis('voice_capture', 'promote')]
    const uplifts: RetentionUpliftResult[] = []
    const decision = decidePromotionForUser(target, analyses, uplifts)
    // 0 uplift + 20 cluster + 0 tenure = 20
    expect(decision.priority_score).toBe(20)
  })

  it('email_template_suggestion mappe correctement (voice_capture → feature_promo_voice_capture)', () => {
    const target = makeTarget({ cluster: 'new_user', tenure_months: 2 })
    const analyses: FeatureAnalysis[] = [makeAnalysis('voice_capture', 'promote')]
    const uplifts: RetentionUpliftResult[] = []
    const decision = decidePromotionForUser(target, analyses, uplifts)
    expect(decision.email_template_suggestion).toBe('feature_promo_voice_capture')
  })

  it('no-op retourne email_template_suggestion = no_promo_this_week', () => {
    const target = makeTarget()
    const decision = decidePromotionForUser(target, [], [])
    expect(decision.feature_to_promote).toBeNull()
    expect(decision.email_template_suggestion).toBe('no_promo_this_week')
  })

  it('no-op pour churning user retourne reason explicit retention', () => {
    const target = makeTarget({ cluster: 'churning' })
    const decision = decidePromotionForUser(target, [], [])
    expect(decision.feature_to_promote).toBeNull()
    expect(decision.reason).toContain('churning')
    expect(decision.reason).toContain('retention')
  })

  it('top candidate gagne quand plusieurs features éligibles (priorité au plus haut score)', () => {
    const target = makeTarget({ cluster: 'occasional_solo', tenure_months: 2 })
    const analyses: FeatureAnalysis[] = [
      makeAnalysis('voice_capture', 'promote'),
      makeAnalysis('liciel_export', 'promote'),
    ]
    const uplifts: RetentionUpliftResult[] = [
      makeUplift('voice_capture', 'high_priority_promote'), // +50 uplift
      makeUplift('liciel_export', 'consider_promote'), // +20 uplift
    ]
    const decision = decidePromotionForUser(target, analyses, uplifts)
    // voice_capture devrait gagner (50 vs 20 uplift, et cluster fit aussi)
    expect(decision.feature_to_promote).toBe('voice_capture')
    expect(decision.priority_score).toBeGreaterThanOrEqual(70)
  })
})

describe('decidePromotionForUser — reason building', () => {
  it("reason mentionne 'fit cluster' quand cluster fit présent", () => {
    const target = makeTarget({ cluster: 'occasional_solo', tenure_months: 2 })
    const analyses: FeatureAnalysis[] = [makeAnalysis('voice_capture', 'promote')]
    const decision = decidePromotionForUser(target, analyses, [])
    expect(decision.reason).toContain('cluster')
  })

  it("reason mentionne 'uplift rétention élevé' pour high_priority_promote", () => {
    const target = makeTarget({ cluster: 'occasional_solo', tenure_months: 2 })
    const analyses: FeatureAnalysis[] = [makeAnalysis('voice_capture', 'promote')]
    const uplifts: RetentionUpliftResult[] = [makeUplift('voice_capture', 'high_priority_promote')]
    const decision = decidePromotionForUser(target, analyses, uplifts)
    expect(decision.reason).toContain('élevé')
  })

  it("reason mentionne 'tenure idéal' quand fenêtre temporelle correcte", () => {
    const target = makeTarget({ cluster: 'occasional_solo', tenure_months: 2 })
    const analyses: FeatureAnalysis[] = [makeAnalysis('voice_capture', 'promote')]
    const decision = decidePromotionForUser(target, analyses, [])
    expect(decision.reason).toContain('tenure')
  })
})

describe('rankPromotionDecisions', () => {
  function makeDecision(
    user_id: string,
    feature_to_promote: FeatureId | null,
    priority_score: number,
  ): PromotionDecision {
    return {
      user_id,
      feature_to_promote,
      priority_score,
      reason: '',
      email_template_suggestion: feature_to_promote
        ? `feature_promo_${feature_to_promote}`
        : 'no_promo_this_week',
    }
  }

  it('trie par priority_score décroissant', () => {
    const decisions = [
      makeDecision('u1', 'voice_capture', 30),
      makeDecision('u2', 'analytics', 80),
      makeDecision('u3', 'devis', 50),
    ]
    const result = rankPromotionDecisions(decisions, 10)
    expect(result.map((d) => d.user_id)).toEqual(['u2', 'u3', 'u1'])
  })

  it('limite à max_count', () => {
    const decisions = [
      makeDecision('u1', 'voice_capture', 30),
      makeDecision('u2', 'analytics', 80),
      makeDecision('u3', 'devis', 50),
    ]
    const result = rankPromotionDecisions(decisions, 2)
    expect(result).toHaveLength(2)
    expect(result.map((d) => d.user_id)).toEqual(['u2', 'u3'])
  })

  it('exclut les décisions sans feature_to_promote (null)', () => {
    const decisions = [makeDecision('u1', null, 0), makeDecision('u2', 'analytics', 80)]
    const result = rankPromotionDecisions(decisions, 10)
    expect(result).toHaveLength(1)
    expect(result[0]?.user_id).toBe('u2')
  })

  it('retourne tableau vide si max_count = 0', () => {
    const decisions = [makeDecision('u1', 'voice_capture', 80)]
    expect(rankPromotionDecisions(decisions, 0)).toEqual([])
  })

  it('retourne tableau vide si toutes les décisions sont no-op', () => {
    const decisions = [makeDecision('u1', null, 0), makeDecision('u2', null, 0)]
    expect(rankPromotionDecisions(decisions, 10)).toEqual([])
  })

  it("ne mute pas l'array d'entrée", () => {
    const decisions = [makeDecision('u1', 'voice_capture', 30), makeDecision('u2', 'analytics', 80)]
    const snapshot = decisions.map((d) => d.user_id)
    rankPromotionDecisions(decisions, 10)
    expect(decisions.map((d) => d.user_id)).toEqual(snapshot)
  })
})
