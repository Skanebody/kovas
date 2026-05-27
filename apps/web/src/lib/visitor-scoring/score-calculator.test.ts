import { describe, expect, it } from 'vitest'
import { type VisitorBehavior, buildEmptyBehavior } from './behavior-tracker'
import { computeVisitorScore } from './score-calculator'

function makeBehavior(overrides: Partial<VisitorBehavior> = {}): VisitorBehavior {
  return { ...buildEmptyBehavior('sess_test'), ...overrides }
}

describe('computeVisitorScore — pondérations pages', () => {
  it('pricing visit ajoute +25', () => {
    const r = computeVisitorScore(makeBehavior({ has_visited_pricing: true }))
    const sig = r.signals.find((s) => s.code === 'page_pricing')
    expect(sig?.points).toBe(25)
  })

  it('calculator visit ajoute +30 (signal intent le plus fort des pages)', () => {
    const r = computeVisitorScore(makeBehavior({ has_visited_calculator: true }))
    const sig = r.signals.find((s) => s.code === 'page_calculator')
    expect(sig?.points).toBe(30)
  })

  it('annuaire seul donne un score faible (+5)', () => {
    const r = computeVisitorScore(makeBehavior({ has_visited_annuaire: true }))
    expect(r.raw_total).toBe(5)
  })

  it('toutes les pages cumulées donnent ~120 avant clamp', () => {
    const r = computeVisitorScore(
      makeBehavior({
        has_visited_pricing: true,
        has_visited_features: true,
        has_visited_testimonials: true,
        has_visited_calculator: true,
        has_visited_observatory: true,
        has_visited_blog_or_guides: true,
        has_visited_annuaire: true,
      }),
    )
    // 25 + 15 + 20 + 30 + 15 + 10 + 5 = 120
    expect(r.raw_total).toBe(120)
    // clampé à 100
    expect(r.score).toBe(100)
  })
})

describe('computeVisitorScore — engagement (time/scroll/pages cumulatifs)', () => {
  it('time >= 60s ajoute +10', () => {
    const r = computeVisitorScore(makeBehavior({ time_on_site_seconds: 70 }))
    const sig = r.signals.find((s) => s.code === 'time_60s')
    expect(sig?.points).toBe(10)
  })

  it('time >= 300s cumule +10 + +15 + +10 = 35', () => {
    const r = computeVisitorScore(makeBehavior({ time_on_site_seconds: 350 }))
    const total = r.signals
      .filter((s) => s.code.startsWith('time_'))
      .reduce((sum, s) => sum + s.points, 0)
    expect(total).toBe(35)
  })

  it('scroll >= 80 cumule +5 + +10 = 15', () => {
    const r = computeVisitorScore(makeBehavior({ scroll_depth_max: 85 }))
    const total = r.signals
      .filter((s) => s.code.startsWith('scroll_'))
      .reduce((sum, s) => sum + s.points, 0)
    expect(total).toBe(15)
  })

  it('page_count >= 6 cumule +10 + +10 = 20', () => {
    const r = computeVisitorScore(makeBehavior({ page_count: 7 }))
    const total = r.signals
      .filter((s) => s.code.startsWith('pages_'))
      .reduce((sum, s) => sum + s.points, 0)
    expect(total).toBe(20)
  })

  it('pas de signaux engagement sous les seuils', () => {
    const r = computeVisitorScore(
      makeBehavior({ time_on_site_seconds: 30, scroll_depth_max: 40, page_count: 2 }),
    )
    expect(r.signals.find((s) => s.code.startsWith('time_'))).toBeUndefined()
    expect(r.signals.find((s) => s.code.startsWith('scroll_'))).toBeUndefined()
    expect(r.signals.find((s) => s.code.startsWith('pages_'))).toBeUndefined()
  })
})

describe('computeVisitorScore — actions', () => {
  it('quote_request submitted = +50 (signal le plus fort)', () => {
    const r = computeVisitorScore(makeBehavior({ has_submitted_quote_request: true }))
    expect(r.raw_total).toBe(50)
  })

  it('signup_flow started = +40', () => {
    const r = computeVisitorScore(makeBehavior({ has_started_signup_flow: true }))
    expect(r.raw_total).toBe(40)
  })

  it('signup abandoned soustrait -15', () => {
    const r = computeVisitorScore(
      makeBehavior({ has_started_signup_flow: true, has_abandoned_signup_flow: true }),
    )
    // +40 -15 = +25
    expect(r.raw_total).toBe(25)
  })

  it('videos > 0 ajoute +15', () => {
    const r = computeVisitorScore(makeBehavior({ videos_watched_count: 2 }))
    expect(r.raw_total).toBe(15)
  })
})

describe('computeVisitorScore — returning visitor', () => {
  it('returning + sessions_count >= 3 cumule +15 + +10 = 25', () => {
    const r = computeVisitorScore(makeBehavior({ is_returning_visitor: true, sessions_count: 4 }))
    expect(r.raw_total).toBe(25)
  })

  it('returning seul = +15', () => {
    const r = computeVisitorScore(makeBehavior({ is_returning_visitor: true, sessions_count: 2 }))
    expect(r.raw_total).toBe(15)
  })
})

describe('computeVisitorScore — multipliers source', () => {
  it('referral ×1.5 (le plus élevé)', () => {
    const r = computeVisitorScore(
      makeBehavior({ has_visited_pricing: true, utm_source: 'referral' }),
    )
    // 25 * 1.5 = 37.5 → 38 (arrondi)
    expect(r.raw_total).toBe(38)
    expect(r.score).toBe(38)
  })

  it('tiktok ×0.85 (le plus bas)', () => {
    const r = computeVisitorScore(makeBehavior({ has_visited_pricing: true, utm_source: 'tiktok' }))
    // 25 * 0.85 = 21.25 → 21
    expect(r.raw_total).toBe(21)
  })

  it('unknown ×1.0 ne change rien', () => {
    const r = computeVisitorScore(
      makeBehavior({ has_visited_pricing: true, utm_source: 'unknown' }),
    )
    expect(r.raw_total).toBe(25)
  })

  it("le signal 'source_multiplier' apparaît si multiplier ≠ 1", () => {
    const r = computeVisitorScore(
      makeBehavior({ has_visited_pricing: true, utm_source: 'linkedin' }),
    )
    const sig = r.signals.find((s) => s.code === 'source_multiplier')
    expect(sig).toBeDefined()
    expect(sig?.detail).toContain('1.2')
  })

  it("PAS de signal 'source_multiplier' si multiplier = 1 (unknown)", () => {
    const r = computeVisitorScore(makeBehavior({ utm_source: 'unknown' }))
    expect(r.signals.find((s) => s.code === 'source_multiplier')).toBeUndefined()
  })
})

describe('computeVisitorScore — context', () => {
  it('business hours weekday ajoute +5', () => {
    const r = computeVisitorScore(makeBehavior({ is_business_hours: true, day_of_week: 2 }))
    expect(r.raw_total).toBe(5)
  })

  it('pas de bonus le weekend même en horaires pro', () => {
    const r = computeVisitorScore(makeBehavior({ is_business_hours: true, day_of_week: 0 }))
    expect(r.raw_total).toBe(0)
  })
})

describe('computeVisitorScore — clamp & confidence', () => {
  it('score clampé à 100 max', () => {
    const r = computeVisitorScore(
      makeBehavior({
        has_visited_pricing: true,
        has_visited_features: true,
        has_visited_testimonials: true,
        has_visited_calculator: true,
        has_visited_observatory: true,
        has_visited_blog_or_guides: true,
        has_visited_annuaire: true,
        has_started_signup_flow: true,
        has_submitted_quote_request: true,
        time_on_site_seconds: 600,
        scroll_depth_max: 100,
        page_count: 10,
        utm_source: 'referral',
      }),
    )
    expect(r.score).toBe(100)
    expect(r.raw_total).toBeGreaterThan(100)
  })

  it('score clampé à 0 min (signaux négatifs)', () => {
    const r = computeVisitorScore(makeBehavior({ has_abandoned_signup_flow: true }))
    // -15 → clamp 0
    expect(r.score).toBe(0)
  })

  it('confidence basse sur empty state', () => {
    const r = computeVisitorScore(makeBehavior({ pages_viewed: [] }))
    expect(r.confidence).toBeLessThanOrEqual(0.3)
  })

  it('confidence haute si pages + time + returning + signup', () => {
    const r = computeVisitorScore(
      makeBehavior({
        pages_viewed: ['/', '/tarifs'],
        time_on_site_seconds: 120,
        is_returning_visitor: true,
        has_started_signup_flow: true,
      }),
    )
    // 0.3 + 0.3 + 0.2 + 0.2 = 1.0
    expect(r.confidence).toBe(1)
  })

  it('confidence partielle si juste pages + time (0.6)', () => {
    const r = computeVisitorScore(makeBehavior({ pages_viewed: ['/'], time_on_site_seconds: 60 }))
    expect(r.confidence).toBeCloseTo(0.6, 5)
  })
})
