import { describe, expect, it } from 'vitest'
import { type RecentOfferRecord, decideOffer, isOpportunityInCooldown } from './offer-selector'
import type { UserSignals } from './opportunity-scorer'
import type { UserUpsellContext } from './triggers'

const NOW = '2026-06-01T12:00:00.000Z'

function daysAgo(n: number): string {
  const d = new Date(NOW)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString()
}

const baseContext: UserUpsellContext = {
  user_id: 'u1',
  current_tier: 'solo',
  active_addons: [],
  quota_usage_pct: 90,
  quota_usage_trend_30d: 'increasing',
  fg_dpe_count_last_30d: 8,
  monthly_missions_avg: 15,
  negative_reviews_last_30d: 0,
  client_count: 50,
  on_annual: false,
  tenure_months: 5,
}

const baseSignals: UserSignals = {
  upsell_timing_score: 75,
  health_score: 70,
  tenure_months: 5,
  cluster: 'occasional_solo',
}

describe('isOpportunityInCooldown', () => {
  it('non bloqué si pas d offer récent', () => {
    const status = isOpportunityInCooldown('quota_80', [], NOW)
    expect(status.blocked).toBe(false)
  })

  it('bloqué si même code envoyé < 7 jours (cooldown dur)', () => {
    const offers: RecentOfferRecord[] = [
      { opportunity_code: 'quota_80', sent_at: daysAgo(3), result: 'opened' },
    ]
    const status = isOpportunityInCooldown('quota_80', offers, NOW)
    expect(status.blocked).toBe(true)
    expect(status.remaining_days).toBe(4)
  })

  it('bloqué si même code envoyé < 30j + result ignored', () => {
    const offers: RecentOfferRecord[] = [
      { opportunity_code: 'quota_80', sent_at: daysAgo(15), result: 'ignored' },
    ]
    const status = isOpportunityInCooldown('quota_80', offers, NOW)
    expect(status.blocked).toBe(true)
    expect(status.remaining_days).toBe(15)
  })

  it('non bloqué si > 30j + result ignored', () => {
    const offers: RecentOfferRecord[] = [
      { opportunity_code: 'quota_80', sent_at: daysAgo(35), result: 'ignored' },
    ]
    const status = isOpportunityInCooldown('quota_80', offers, NOW)
    expect(status.blocked).toBe(false)
  })

  it('bloqué si même code envoyé < 90j + result converted', () => {
    const offers: RecentOfferRecord[] = [
      { opportunity_code: 'quota_80', sent_at: daysAgo(60), result: 'converted' },
    ]
    const status = isOpportunityInCooldown('quota_80', offers, NOW)
    expect(status.blocked).toBe(true)
    expect(status.remaining_days).toBe(30)
  })

  it('non bloqué si > 90j + result converted', () => {
    const offers: RecentOfferRecord[] = [
      { opportunity_code: 'quota_80', sent_at: daysAgo(100), result: 'converted' },
    ]
    const status = isOpportunityInCooldown('quota_80', offers, NOW)
    expect(status.blocked).toBe(false)
  })

  it('non bloqué si même code 10j + result opened (pas ignored, pas converted)', () => {
    const offers: RecentOfferRecord[] = [
      { opportunity_code: 'quota_80', sent_at: daysAgo(10), result: 'opened' },
    ]
    const status = isOpportunityInCooldown('quota_80', offers, NOW)
    expect(status.blocked).toBe(false)
  })

  it('ignore les offers d autres codes', () => {
    const offers: RecentOfferRecord[] = [
      { opportunity_code: 'other_code', sent_at: daysAgo(2), result: 'ignored' },
    ]
    const status = isOpportunityInCooldown('quota_80', offers, NOW)
    expect(status.blocked).toBe(false)
  })
})

describe('decideOffer', () => {
  it('priorité retention si churning + health < 40', () => {
    const decision = decideOffer(
      baseContext,
      { ...baseSignals, cluster: 'churning', health_score: 30 },
      [],
      NOW,
    )
    expect(decision.action).toBe('skip')
    expect(decision.reason).toContain('retention')
    expect(decision.next_check_recommended_in_days).toBe(14)
  })

  it('skip si upsell_timing_score < 30', () => {
    const decision = decideOffer(baseContext, { ...baseSignals, upsell_timing_score: 20 }, [], NOW)
    expect(decision.action).toBe('skip')
    expect(decision.reason).toContain('timing')
    expect(decision.next_check_recommended_in_days).toBe(7)
  })

  it('skip si aucune opportunity détectée', () => {
    const decision = decideOffer(
      {
        ...baseContext,
        quota_usage_pct: 20,
        quota_usage_trend_30d: 'stable',
        fg_dpe_count_last_30d: 0,
        monthly_missions_avg: 2,
        negative_reviews_last_30d: 0,
        client_count: 5,
        on_annual: true,
        tenure_months: 1,
      },
      baseSignals,
      [],
      NOW,
    )
    expect(decision.action).toBe('skip')
    expect(decision.reason).toContain('Aucune opportunity')
  })

  it('skip si toutes opportunities en cooldown', () => {
    // baseContext crée multiple opportunities ; on bloque toutes
    const offers: RecentOfferRecord[] = [
      { opportunity_code: 'quota_80', sent_at: daysAgo(2), result: 'opened' },
      { opportunity_code: 'addon_pipeline_mpr', sent_at: daysAgo(2), result: 'opened' },
      { opportunity_code: 'addon_premium_reports', sent_at: daysAgo(2), result: 'opened' },
      { opportunity_code: 'annual_commitment', sent_at: daysAgo(2), result: 'opened' },
    ]
    const decision = decideOffer(baseContext, baseSignals, offers, NOW)
    expect(decision.action).toBe('skip')
    expect(decision.cooldown_active).toBe(true)
    expect(decision.next_check_recommended_in_days).toBeGreaterThanOrEqual(1)
  })

  it('send la top opportunity si tout OK', () => {
    const decision = decideOffer(baseContext, baseSignals, [], NOW)
    expect(decision.action).toBe('send')
    expect(decision.selected_opportunity).toBeDefined()
    expect(decision.selected_opportunity?.trigger_code).toBeDefined()
  })

  it('sélectionne le top composite_score, pas juste le top revenue', () => {
    // power_user → bonus tier_upgrade +0.3 → boost quota_80
    const decision = decideOffer(baseContext, { ...baseSignals, cluster: 'power_user' }, [], NOW)
    expect(decision.action).toBe('send')
    // quota_80 a 50€ revenue mais aussi bonus cluster → top
    expect(decision.selected_opportunity?.trigger_code).toBe('quota_80')
  })

  it('respecte cooldown sur la top et choisit la 2e', () => {
    // Bloque quota_80 (top revenue) → doit choisir la suivante
    const offers: RecentOfferRecord[] = [
      { opportunity_code: 'quota_80', sent_at: daysAgo(2), result: 'opened' },
    ]
    const decision = decideOffer(baseContext, baseSignals, offers, NOW)
    expect(decision.action).toBe('send')
    expect(decision.selected_opportunity?.trigger_code).not.toBe('quota_80')
  })

  it('skip si meilleur composite_score < 30', () => {
    // Cluster churning + health=50 (>40 donc pas le early-skip retention)
    // → multiplicateur churning ≤ 0.3, donc composite très faible
    const decision = decideOffer(
      baseContext,
      {
        upsell_timing_score: 35, // > 30 pour passer le early-skip timing
        health_score: 50,
        tenure_months: 5,
        cluster: 'churning',
      },
      [],
      NOW,
    )
    expect(decision.action).toBe('skip')
    expect(decision.next_check_recommended_in_days).toBe(14)
  })

  it('next_check_recommended_in_days correct selon raison du skip', () => {
    // Cas timing bas → 7 jours
    const skipTiming = decideOffer(
      baseContext,
      { ...baseSignals, upsell_timing_score: 10 },
      [],
      NOW,
    )
    expect(skipTiming.next_check_recommended_in_days).toBe(7)

    // Cas churning retention → 14 jours
    const skipChurn = decideOffer(
      baseContext,
      { ...baseSignals, cluster: 'churning', health_score: 20 },
      [],
      NOW,
    )
    expect(skipChurn.next_check_recommended_in_days).toBe(14)
  })

  it('next_check basé sur remaining cooldown si skip pour cooldown', () => {
    const offers: RecentOfferRecord[] = [
      { opportunity_code: 'quota_80', sent_at: daysAgo(1), result: 'opened' },
      { opportunity_code: 'addon_pipeline_mpr', sent_at: daysAgo(1), result: 'opened' },
      { opportunity_code: 'addon_premium_reports', sent_at: daysAgo(1), result: 'opened' },
      { opportunity_code: 'annual_commitment', sent_at: daysAgo(1), result: 'opened' },
    ]
    const decision = decideOffer(baseContext, baseSignals, offers, NOW)
    expect(decision.action).toBe('skip')
    expect(decision.cooldown_active).toBe(true)
    // remaining_days ≈ 6 (7 - 1)
    expect(decision.next_check_recommended_in_days).toBeGreaterThanOrEqual(5)
    expect(decision.next_check_recommended_in_days).toBeLessThanOrEqual(7)
  })

  it('ignore les converted > 90 jours dans le cooldown', () => {
    const offers: RecentOfferRecord[] = [
      { opportunity_code: 'quota_80', sent_at: daysAgo(100), result: 'converted' },
    ]
    const decision = decideOffer(baseContext, baseSignals, offers, NOW)
    expect(decision.action).toBe('send')
  })

  it('reason contient le trigger_code en cas de send', () => {
    const decision = decideOffer(baseContext, baseSignals, [], NOW)
    if (decision.action === 'send' && decision.selected_opportunity) {
      expect(decision.reason).toContain(decision.selected_opportunity.trigger_code)
    }
  })

  it('priorité retention NON déclenchée si churning + health_score null', () => {
    // health_score null → ne déclenche pas le early-skip retention
    const decision = decideOffer(
      baseContext,
      { ...baseSignals, cluster: 'churning', health_score: null },
      [],
      NOW,
    )
    // Mais churning a cap dur → composite très bas → skip via min_composite
    expect(decision.action).toBe('skip')
  })
})
