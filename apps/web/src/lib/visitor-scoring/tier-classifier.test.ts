import { describe, expect, it } from 'vitest'
import { type VisitorBehavior, buildEmptyBehavior } from './behavior-tracker'
import { type VisitorScoreResult, computeVisitorScore } from './score-calculator'
import { classifyVisitor } from './tier-classifier'

function makeBehavior(overrides: Partial<VisitorBehavior> = {}): VisitorBehavior {
  return { ...buildEmptyBehavior('sess_test'), ...overrides }
}

function makeScore(score: number, behavior?: VisitorBehavior): VisitorScoreResult {
  return {
    score,
    raw_total: score,
    signals: [],
    confidence: behavior ? computeVisitorScore(behavior).confidence : 0.5,
  }
}

describe('classifyVisitor — tier rules', () => {
  it('HOT : score >= 70 ET (pricing OU calculator completion)', () => {
    const b = makeBehavior({ has_visited_pricing: true, page_count: 4 })
    const c = classifyVisitor(makeScore(75, b), b)
    expect(c.tier).toBe('hot')
  })

  it('HOT alternative : score >= 70 ET calculator completion', () => {
    const b = makeBehavior({
      has_used_calculator_to_completion: true,
      page_count: 3,
    })
    const c = classifyVisitor(makeScore(80, b), b)
    expect(c.tier).toBe('hot')
  })

  it('NOT HOT : score >= 70 mais pas de signal commercial (pricing/calculator)', () => {
    const b = makeBehavior({
      has_visited_features: true,
      has_visited_observatory: true,
      page_count: 5,
    })
    // Score haut mais commercial signals manquent → warm seulement
    const c = classifyVisitor(makeScore(75, b), b)
    expect(c.tier).toBe('warm')
  })

  it('WARM : score >= 40 sans condition pricing/calculator', () => {
    const b = makeBehavior({ has_visited_features: true, page_count: 3 })
    const c = classifyVisitor(makeScore(45, b), b)
    expect(c.tier).toBe('warm')
  })

  it('COLD : score 15-39 avec engagement minimal (>=2 pages OU >=30s)', () => {
    const b = makeBehavior({ page_count: 2, time_on_site_seconds: 60 })
    const c = classifyVisitor(makeScore(20, b), b)
    expect(c.tier).toBe('cold')
  })

  it('COLD : score 15-39 avec time >= 30s mais 1 page', () => {
    const b = makeBehavior({ page_count: 1, time_on_site_seconds: 45 })
    const c = classifyVisitor(makeScore(20, b), b)
    expect(c.tier).toBe('cold')
  })

  it('COLD_ANONYMOUS : score < 15', () => {
    const b = makeBehavior({ page_count: 1, time_on_site_seconds: 5 })
    const c = classifyVisitor(makeScore(10, b), b)
    expect(c.tier).toBe('cold_anonymous')
  })

  it('COLD_ANONYMOUS : score 15-39 mais zero engagement (< 2 pages ET < 30s)', () => {
    const b = makeBehavior({ page_count: 1, time_on_site_seconds: 10 })
    const c = classifyVisitor(makeScore(20, b), b)
    expect(c.tier).toBe('cold_anonymous')
  })
})

describe('classifyVisitor — primary_action par tier', () => {
  it('HOT → show_trial_cta_primary', () => {
    const b = makeBehavior({ has_visited_pricing: true })
    const c = classifyVisitor(makeScore(80, b), b)
    expect(c.primary_action).toBe('show_trial_cta_primary')
  })

  it('WARM → show_demo_cta', () => {
    const b = makeBehavior({ has_visited_features: true })
    const c = classifyVisitor(makeScore(50, b), b)
    expect(c.primary_action).toBe('show_demo_cta')
  })

  it('COLD → show_learn_more', () => {
    const b = makeBehavior({ page_count: 2 })
    const c = classifyVisitor(makeScore(20, b), b)
    expect(c.primary_action).toBe('show_learn_more')
  })

  it('COLD_ANONYMOUS → show_lead_magnet', () => {
    const b = makeBehavior()
    const c = classifyVisitor(makeScore(5, b), b)
    expect(c.primary_action).toBe('show_lead_magnet')
  })
})

describe('classifyVisitor — secondary_actions', () => {
  it('HOT identifié (newsletter) → trigger_hot_lead_email + slack_alert', () => {
    const b = makeBehavior({
      has_visited_pricing: true,
      has_signed_up_newsletter: true,
    })
    const c = classifyVisitor(makeScore(80, b), b)
    expect(c.secondary_actions).toContain('trigger_hot_lead_email')
    expect(c.secondary_actions).toContain('slack_alert_benjamin')
  })

  it("HOT anonyme → slack_alert seulement (pas d'email sans contact)", () => {
    const b = makeBehavior({ has_visited_pricing: true })
    const c = classifyVisitor(makeScore(80, b), b)
    expect(c.secondary_actions).not.toContain('trigger_hot_lead_email')
    expect(c.secondary_actions).toContain('slack_alert_benjamin')
  })

  it('WARM identifié → trigger_nurture_sequence', () => {
    const b = makeBehavior({
      has_visited_features: true,
      is_authenticated: true,
    })
    const c = classifyVisitor(makeScore(45, b), b)
    expect(c.secondary_actions).toContain('trigger_nurture_sequence')
  })

  it('WARM anonyme → secondary vide', () => {
    const b = makeBehavior({ has_visited_features: true })
    const c = classifyVisitor(makeScore(45, b), b)
    expect(c.secondary_actions).toHaveLength(0)
  })

  it('COLD → capture_email_softly', () => {
    const b = makeBehavior({ page_count: 2 })
    const c = classifyVisitor(makeScore(20, b), b)
    expect(c.secondary_actions).toContain('capture_email_softly')
  })

  it('COLD_ANONYMOUS → secondary vide', () => {
    const b = makeBehavior()
    const c = classifyVisitor(makeScore(5, b), b)
    expect(c.secondary_actions).toHaveLength(0)
  })
})

describe('classifyVisitor — show_pricing_inline rules', () => {
  it('HOT → show_pricing_inline true', () => {
    const b = makeBehavior({ has_visited_pricing: true })
    const c = classifyVisitor(makeScore(80, b), b)
    expect(c.show_pricing_inline).toBe(true)
  })

  it('WARM → show_pricing_inline true', () => {
    const b = makeBehavior({ has_visited_features: true })
    const c = classifyVisitor(makeScore(45, b), b)
    expect(c.show_pricing_inline).toBe(true)
  })

  it('COLD → show_pricing_inline false', () => {
    const b = makeBehavior({ page_count: 2 })
    const c = classifyVisitor(makeScore(20, b), b)
    expect(c.show_pricing_inline).toBe(false)
  })

  it('COLD_ANONYMOUS → show_pricing_inline false', () => {
    const b = makeBehavior()
    const c = classifyVisitor(makeScore(5, b), b)
    expect(c.show_pricing_inline).toBe(false)
  })
})

describe('classifyVisitor — show_calculator_widget', () => {
  it("HOT n'ayant pas vu le calculateur → widget affiché", () => {
    const b = makeBehavior({ has_visited_pricing: true })
    const c = classifyVisitor(makeScore(80, b), b)
    expect(c.show_calculator_widget).toBe(true)
  })

  it('HOT ayant déjà visité le calculateur → widget masqué (anti-redondance)', () => {
    const b = makeBehavior({
      has_visited_pricing: true,
      has_visited_calculator: true,
    })
    const c = classifyVisitor(makeScore(80, b), b)
    expect(c.show_calculator_widget).toBe(false)
  })

  it('HOT ayant complété le calculateur → widget masqué', () => {
    const b = makeBehavior({
      has_visited_pricing: true,
      has_used_calculator_to_completion: true,
    })
    const c = classifyVisitor(makeScore(80, b), b)
    expect(c.show_calculator_widget).toBe(false)
  })

  it('COLD_ANONYMOUS → widget jamais affiché', () => {
    const b = makeBehavior()
    const c = classifyVisitor(makeScore(5, b), b)
    expect(c.show_calculator_widget).toBe(false)
  })
})

describe('classifyVisitor — message_intensity', () => {
  it('HOT → prominent', () => {
    const b = makeBehavior({ has_visited_pricing: true })
    const c = classifyVisitor(makeScore(80, b), b)
    expect(c.message_intensity).toBe('prominent')
  })

  it('WARM → normal', () => {
    const b = makeBehavior({ has_visited_features: true })
    const c = classifyVisitor(makeScore(45, b), b)
    expect(c.message_intensity).toBe('normal')
  })

  it('COLD → normal', () => {
    const b = makeBehavior({ page_count: 2 })
    const c = classifyVisitor(makeScore(20, b), b)
    expect(c.message_intensity).toBe('normal')
  })

  it('COLD_ANONYMOUS → discreet', () => {
    const b = makeBehavior()
    const c = classifyVisitor(makeScore(5, b), b)
    expect(c.message_intensity).toBe('discreet')
  })
})

describe('classifyVisitor — human_message', () => {
  it('contient le tier + score + source + page_count', () => {
    const b = makeBehavior({
      has_visited_pricing: true,
      utm_source: 'linkedin',
      page_count: 4,
    })
    const c = classifyVisitor(makeScore(80, b), b)
    expect(c.human_message).toContain('Hot')
    expect(c.human_message).toContain('80')
    expect(c.human_message).toContain('linkedin')
    expect(c.human_message).toContain('4')
  })
})

describe('classifyVisitor — intégration avec computeVisitorScore', () => {
  it('scénario réaliste : LinkedIn lead lit /tarifs + démarre signup → HOT', () => {
    const b = makeBehavior({
      utm_source: 'linkedin',
      has_visited_pricing: true,
      has_visited_features: true,
      has_started_signup_flow: true,
      time_on_site_seconds: 200,
      scroll_depth_max: 85,
      page_count: 4,
      is_business_hours: true,
      day_of_week: 3,
    })
    const score_result = computeVisitorScore(b)
    const c = classifyVisitor(score_result, b)
    expect(c.tier).toBe('hot')
    expect(c.primary_action).toBe('show_trial_cta_primary')
    expect(c.score).toBe(score_result.score)
  })

  it('scénario visiteur passif : 1 page rebond → COLD_ANONYMOUS', () => {
    const b = makeBehavior({
      utm_source: 'tiktok',
      time_on_site_seconds: 8,
      page_count: 1,
    })
    const score_result = computeVisitorScore(b)
    const c = classifyVisitor(score_result, b)
    expect(c.tier).toBe('cold_anonymous')
    expect(c.primary_action).toBe('show_lead_magnet')
    expect(c.show_pricing_inline).toBe(false)
  })
})
