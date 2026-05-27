import { describe, expect, it } from 'vitest'
import {
  type UserUpsellContext,
  detectAllOpportunities,
  detectAnnualCommitmentOpportunity,
  detectAutoReviewResponseOpportunity,
  detectNewsletterClientsOpportunity,
  detectPipelineMprOpportunity,
  detectPremiumReportsOpportunity,
  detectQuotaUpgradeOpportunity,
} from './triggers'

const baseContext: UserUpsellContext = {
  user_id: 'u1',
  current_tier: 'solo',
  active_addons: [],
  quota_usage_pct: 50,
  quota_usage_trend_30d: 'stable',
  fg_dpe_count_last_30d: 0,
  monthly_missions_avg: 5,
  negative_reviews_last_30d: 0,
  client_count: 20,
  on_annual: false,
  tenure_months: 1,
}

describe('detectQuotaUpgradeOpportunity', () => {
  it('retourne null si quota_usage_pct < 80', () => {
    const result = detectQuotaUpgradeOpportunity({
      ...baseContext,
      quota_usage_pct: 79,
      quota_usage_trend_30d: 'increasing',
    })
    expect(result).toBeNull()
  })

  it('retourne null si tendance decreasing même avec quota 90%', () => {
    const result = detectQuotaUpgradeOpportunity({
      ...baseContext,
      quota_usage_pct: 90,
      quota_usage_trend_30d: 'decreasing',
    })
    expect(result).toBeNull()
  })

  it('retourne null si current_tier = enterprise', () => {
    const result = detectQuotaUpgradeOpportunity({
      ...baseContext,
      current_tier: 'enterprise',
      quota_usage_pct: 95,
      quota_usage_trend_30d: 'increasing',
    })
    expect(result).toBeNull()
  })

  it('retourne null si quota_usage_pct est null', () => {
    const result = detectQuotaUpgradeOpportunity({
      ...baseContext,
      quota_usage_pct: null,
      quota_usage_trend_30d: 'increasing',
    })
    expect(result).toBeNull()
  })

  it('détecte solo → pro avec revenue +50€', () => {
    const result = detectQuotaUpgradeOpportunity({
      ...baseContext,
      current_tier: 'solo',
      quota_usage_pct: 85,
      quota_usage_trend_30d: 'increasing',
    })
    expect(result).not.toBeNull()
    expect(result?.from_tier).toBe('solo')
    expect(result?.to_tier).toBe('pro')
    expect(result?.base_revenue_potential_eur).toBe(50) // 79 - 29
    expect(result?.type).toBe('tier_upgrade')
    expect(result?.reason).toContain('Pro')
    expect(result?.reason).toContain('100')
  })

  it('détecte pro → cabinet avec revenue +120€', () => {
    const result = detectQuotaUpgradeOpportunity({
      ...baseContext,
      current_tier: 'pro',
      quota_usage_pct: 95,
      quota_usage_trend_30d: 'stable',
    })
    expect(result?.to_tier).toBe('cabinet')
    expect(result?.base_revenue_potential_eur).toBe(120) // 199 - 79
  })

  it('détecte cabinet → cabinet_plus avec revenue +300€', () => {
    const result = detectQuotaUpgradeOpportunity({
      ...baseContext,
      current_tier: 'cabinet',
      quota_usage_pct: 100,
      quota_usage_trend_30d: 'increasing',
    })
    expect(result?.to_tier).toBe('cabinet_plus')
    expect(result?.base_revenue_potential_eur).toBe(300) // 499 - 199
  })

  it('détecte cabinet_plus → enterprise avec revenue estimé 500€', () => {
    const result = detectQuotaUpgradeOpportunity({
      ...baseContext,
      current_tier: 'cabinet_plus',
      quota_usage_pct: 92,
      quota_usage_trend_30d: 'increasing',
    })
    expect(result?.to_tier).toBe('enterprise')
    expect(result?.base_revenue_potential_eur).toBe(500)
    expect(result?.reason).toContain('illimité')
  })
})

describe('detectPipelineMprOpportunity', () => {
  it('retourne null si fg_dpe_count < 5', () => {
    const result = detectPipelineMprOpportunity({
      ...baseContext,
      fg_dpe_count_last_30d: 4,
    })
    expect(result).toBeNull()
  })

  it('retourne null si addon déjà actif', () => {
    const result = detectPipelineMprOpportunity({
      ...baseContext,
      fg_dpe_count_last_30d: 10,
      active_addons: ['pipeline_maprimerenov'],
    })
    expect(result).toBeNull()
  })

  it('détecte avec 5+ DPE F/G', () => {
    const result = detectPipelineMprOpportunity({
      ...baseContext,
      fg_dpe_count_last_30d: 7,
    })
    expect(result).not.toBeNull()
    expect(result?.type).toBe('addon')
    expect(result?.addon).toBe('pipeline_maprimerenov')
    expect(result?.base_revenue_potential_eur).toBe(19)
    expect(result?.reason).toContain('7 DPE F/G')
  })
})

describe('detectPremiumReportsOpportunity', () => {
  it('retourne null si monthly_missions_avg < 10', () => {
    const result = detectPremiumReportsOpportunity({
      ...baseContext,
      monthly_missions_avg: 8,
      tenure_months: 5,
    })
    expect(result).toBeNull()
  })

  it('retourne null si tenure < 2 mois', () => {
    const result = detectPremiumReportsOpportunity({
      ...baseContext,
      monthly_missions_avg: 15,
      tenure_months: 1,
    })
    expect(result).toBeNull()
  })

  it('retourne null si addon déjà actif', () => {
    const result = detectPremiumReportsOpportunity({
      ...baseContext,
      monthly_missions_avg: 20,
      tenure_months: 5,
      active_addons: ['premium_reports'],
    })
    expect(result).toBeNull()
  })

  it('détecte si missions 10+ et tenure 2+', () => {
    const result = detectPremiumReportsOpportunity({
      ...baseContext,
      monthly_missions_avg: 12,
      tenure_months: 3,
    })
    expect(result).not.toBeNull()
    expect(result?.addon).toBe('premium_reports')
    expect(result?.base_revenue_potential_eur).toBe(14)
    expect(result?.reason).toContain('12 rapports')
  })
})

describe('detectAutoReviewResponseOpportunity', () => {
  it('retourne null si pas de review négative', () => {
    const result = detectAutoReviewResponseOpportunity(baseContext)
    expect(result).toBeNull()
  })

  it('retourne null si addon déjà actif', () => {
    const result = detectAutoReviewResponseOpportunity({
      ...baseContext,
      negative_reviews_last_30d: 2,
      active_addons: ['auto_review_response'],
    })
    expect(result).toBeNull()
  })

  it('détecte avec 1+ review négative', () => {
    const result = detectAutoReviewResponseOpportunity({
      ...baseContext,
      negative_reviews_last_30d: 2,
    })
    expect(result?.addon).toBe('auto_review_response')
    expect(result?.base_revenue_potential_eur).toBe(9)
    expect(result?.reason).toContain('2 review')
  })
})

describe('detectNewsletterClientsOpportunity', () => {
  it('retourne null si client_count < 100', () => {
    const result = detectNewsletterClientsOpportunity({
      ...baseContext,
      client_count: 50,
      tenure_months: 6,
    })
    expect(result).toBeNull()
  })

  it('retourne null si tenure < 3', () => {
    const result = detectNewsletterClientsOpportunity({
      ...baseContext,
      client_count: 200,
      tenure_months: 2,
    })
    expect(result).toBeNull()
  })

  it('retourne null si addon déjà actif', () => {
    const result = detectNewsletterClientsOpportunity({
      ...baseContext,
      client_count: 150,
      tenure_months: 5,
      active_addons: ['newsletter_clients'],
    })
    expect(result).toBeNull()
  })

  it('détecte si 100+ clients et tenure 3+', () => {
    const result = detectNewsletterClientsOpportunity({
      ...baseContext,
      client_count: 150,
      tenure_months: 4,
    })
    expect(result?.addon).toBe('newsletter_clients')
    expect(result?.base_revenue_potential_eur).toBe(19)
    expect(result?.reason).toContain('150 clients')
  })
})

describe('detectAnnualCommitmentOpportunity', () => {
  it('retourne null si déjà sur annual', () => {
    const result = detectAnnualCommitmentOpportunity({
      ...baseContext,
      on_annual: true,
      tenure_months: 8,
    })
    expect(result).toBeNull()
  })

  it('retourne null si tenure < 4', () => {
    const result = detectAnnualCommitmentOpportunity({
      ...baseContext,
      tenure_months: 3,
    })
    expect(result).toBeNull()
  })

  it('retourne null si enterprise', () => {
    const result = detectAnnualCommitmentOpportunity({
      ...baseContext,
      current_tier: 'enterprise',
      tenure_months: 10,
    })
    expect(result).toBeNull()
  })

  it('détecte économie correcte pour Solo (29€/mo × 12 × 0.15 ≈ 52€/an)', () => {
    const result = detectAnnualCommitmentOpportunity({
      ...baseContext,
      current_tier: 'solo',
      tenure_months: 5,
    })
    expect(result).not.toBeNull()
    expect(result?.type).toBe('annual_commitment')
    expect(result?.reason).toContain('52')
    // base_revenue = 29 × 0.5 ≈ 15 (sécurisation LTV approximée)
    expect(result?.base_revenue_potential_eur).toBeGreaterThan(0)
  })

  it('détecte économie pour Cabinet (199€ × 12 × 0.15 = 358€)', () => {
    const result = detectAnnualCommitmentOpportunity({
      ...baseContext,
      current_tier: 'cabinet',
      tenure_months: 6,
    })
    expect(result?.reason).toContain('358')
  })
})

describe('detectAllOpportunities', () => {
  it('retourne array vide si aucune condition remplie', () => {
    const result = detectAllOpportunities(baseContext)
    expect(result).toEqual([])
  })

  it('détecte plusieurs triggers et trie par revenue desc', () => {
    const result = detectAllOpportunities({
      ...baseContext,
      current_tier: 'pro',
      quota_usage_pct: 90,
      quota_usage_trend_30d: 'increasing',
      fg_dpe_count_last_30d: 8,
      monthly_missions_avg: 15,
      tenure_months: 5,
      client_count: 200,
      negative_reviews_last_30d: 1,
    })
    expect(result.length).toBeGreaterThanOrEqual(5)
    // Tri desc par revenue : quota_80 (120€) doit être premier
    expect(result[0]?.trigger_code).toBe('quota_80')
    expect(result[0]?.base_revenue_potential_eur).toBe(120)
    // Ordre desc vérifié
    for (let i = 1; i < result.length; i++) {
      const current = result[i]
      const prev = result[i - 1]
      if (current && prev) {
        expect(current.base_revenue_potential_eur).toBeLessThanOrEqual(
          prev.base_revenue_potential_eur,
        )
      }
    }
  })

  it('respecte les addons déjà actifs (skip ceux-là)', () => {
    const result = detectAllOpportunities({
      ...baseContext,
      fg_dpe_count_last_30d: 10,
      negative_reviews_last_30d: 2,
      active_addons: ['pipeline_maprimerenov', 'auto_review_response'],
    })
    expect(result.find((o) => o.addon === 'pipeline_maprimerenov')).toBeUndefined()
    expect(result.find((o) => o.addon === 'auto_review_response')).toBeUndefined()
  })
})
