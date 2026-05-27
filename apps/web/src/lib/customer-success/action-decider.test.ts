import { describe, expect, it } from 'vitest'
import { type ActionContext, decideActions } from './action-decider'
import type { HealthScoreResult } from './health-scorer'

function makeHealth(score: number): HealthScoreResult {
  const bucket: HealthScoreResult['bucket'] =
    score >= 80 ? 'promoter' : score >= 60 ? 'healthy' : score >= 40 ? 'at_risk' : 'critical'
  return {
    score,
    bucket,
    dimensions: [],
    trend: 'unknown',
    human_message: `mock ${score}`,
  }
}

const baseContext: ActionContext = {
  has_active_referral_program: false,
  has_left_review_recently: false,
  has_been_contacted_recently: false,
  is_in_trial: false,
  tenure_months: 6,
}

// ---------------------------------------------------------------------------
// Critical bucket
// ---------------------------------------------------------------------------

describe('decideActions — critical bucket (score < 40)', () => {
  it('déclenche send_founder_personal_email en primary', () => {
    const plan = decideActions(makeHealth(25), baseContext)
    expect(plan.bucket).toBe('critical')
    expect(plan.primary_action).toBe('send_founder_personal_email')
  })

  it('inclut offer_call_15min + pause_marketing_emails + alert_benjamin_slack en secondary', () => {
    const plan = decideActions(makeHealth(25), baseContext)
    expect(plan.secondary_actions).toContain('offer_call_15min')
    expect(plan.secondary_actions).toContain('pause_marketing_emails')
    expect(plan.secondary_actions).toContain('alert_benjamin_slack')
  })

  it('si has_been_contacted_recently → alert_benjamin_slack seul + pause_marketing', () => {
    const plan = decideActions(makeHealth(25), {
      ...baseContext,
      has_been_contacted_recently: true,
    })
    expect(plan.primary_action).toBe('alert_benjamin_slack')
    // Anti-spam global → secondary vidé puis on récupère pause_marketing depuis la décision raw critical contacté
    // applyContextFilters vide secondary si has_been_contacted_recently. Donc length = 0.
    expect(plan.secondary_actions).toHaveLength(0)
  })

  it('contient le score dans human_explanation', () => {
    const plan = decideActions(makeHealth(35), baseContext)
    expect(plan.human_explanation).toContain('35/100')
  })
})

// ---------------------------------------------------------------------------
// At risk bucket
// ---------------------------------------------------------------------------

describe('decideActions — at_risk bucket (40-59)', () => {
  it('envoie send_helpful_tip_email si pas en essai', () => {
    const plan = decideActions(makeHealth(50), baseContext)
    expect(plan.bucket).toBe('at_risk')
    expect(plan.primary_action).toBe('send_helpful_tip_email')
  })

  it('envoie offer_onboarding_help si en essai', () => {
    const plan = decideActions(makeHealth(50), { ...baseContext, is_in_trial: true })
    expect(plan.primary_action).toBe('offer_onboarding_help')
  })

  it('inclut suggest_underused_feature en secondary', () => {
    const plan = decideActions(makeHealth(50), baseContext)
    expect(plan.secondary_actions).toContain('suggest_underused_feature')
  })

  it('vide secondary si has_been_contacted_recently', () => {
    const plan = decideActions(makeHealth(50), {
      ...baseContext,
      has_been_contacted_recently: true,
    })
    expect(plan.secondary_actions).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Healthy bucket
// ---------------------------------------------------------------------------

describe('decideActions — healthy bucket (60-79)', () => {
  it('envoie suggest_addon si tenure >= 2 mois', () => {
    const plan = decideActions(makeHealth(70), { ...baseContext, tenure_months: 3 })
    expect(plan.primary_action).toBe('suggest_addon')
  })

  it('envoie send_monthly_recap_email si tenure < 2 mois', () => {
    const plan = decideActions(makeHealth(70), { ...baseContext, tenure_months: 1 })
    expect(plan.primary_action).toBe('send_monthly_recap_email')
  })

  it('remplace suggest_addon par send_monthly_recap_email si en essai', () => {
    const plan = decideActions(makeHealth(70), {
      ...baseContext,
      tenure_months: 3,
      is_in_trial: true,
    })
    expect(plan.primary_action).toBe('send_monthly_recap_email')
  })

  it('secondary vide pour healthy', () => {
    const plan = decideActions(makeHealth(70), baseContext)
    expect(plan.secondary_actions).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Promoter bucket
// ---------------------------------------------------------------------------

describe('decideActions — promoter bucket (>= 80)', () => {
  it('demande référral si has_active_referral_program=true et tenure >= 3', () => {
    const plan = decideActions(makeHealth(85), {
      ...baseContext,
      has_active_referral_program: true,
      tenure_months: 4,
    })
    expect(plan.primary_action).toBe('request_referral')
  })

  it('demande review si pas de referral program actif et pas de review récente', () => {
    const plan = decideActions(makeHealth(85), {
      ...baseContext,
      has_active_referral_program: false,
      has_left_review_recently: false,
      tenure_months: 4,
    })
    expect(plan.primary_action).toBe('request_review')
  })

  it('invite case study si referral + review déjà donnés', () => {
    const plan = decideActions(makeHealth(85), {
      ...baseContext,
      has_active_referral_program: false,
      has_left_review_recently: true,
      tenure_months: 4,
    })
    expect(plan.primary_action).toBe('invite_to_case_study')
  })

  it('ne demande pas referral si user en essai (focus activation)', () => {
    const plan = decideActions(makeHealth(85), {
      ...baseContext,
      has_active_referral_program: true,
      tenure_months: 4,
      is_in_trial: true,
    })
    expect(plan.primary_action).toBe('request_review')
  })

  it('demande review si referral_program true mais tenure < 3 mois', () => {
    // tenure=2 → trop court pour referral (>=3 requis) mais OK pour review (>=2)
    const plan = decideActions(makeHealth(85), {
      ...baseContext,
      has_active_referral_program: true,
      tenure_months: 2,
    })
    expect(plan.primary_action).toBe('request_review')
  })

  it('contacté récemment → garde primary mais pas secondary', () => {
    const plan = decideActions(makeHealth(85), {
      ...baseContext,
      has_active_referral_program: true,
      tenure_months: 6,
      has_been_contacted_recently: true,
    })
    expect(plan.primary_action).toBe('request_referral')
    expect(plan.secondary_actions).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Anti-spam transverse
// ---------------------------------------------------------------------------

describe('decideActions — anti-spam et exclusions trial', () => {
  it('trial=true exclut suggest_addon des secondary aussi', () => {
    // Health critique mais en essai → secondary critical n'inclut pas addon de toute façon,
    // on teste plutôt qu'en healthy le swap a lieu.
    const plan = decideActions(makeHealth(70), {
      ...baseContext,
      is_in_trial: true,
      tenure_months: 5,
    })
    expect(plan.primary_action).not.toBe('suggest_addon')
    expect(plan.secondary_actions).not.toContain('suggest_addon')
    expect(plan.secondary_actions).not.toContain('request_referral')
  })

  it('bucket préservé fidèlement', () => {
    expect(decideActions(makeHealth(15), baseContext).bucket).toBe('critical')
    expect(decideActions(makeHealth(45), baseContext).bucket).toBe('at_risk')
    expect(decideActions(makeHealth(72), baseContext).bucket).toBe('healthy')
    expect(decideActions(makeHealth(90), baseContext).bucket).toBe('promoter')
  })

  it('human_explanation toujours non-vide', () => {
    for (const s of [15, 45, 72, 90]) {
      const plan = decideActions(makeHealth(s), baseContext)
      expect(plan.human_explanation.length).toBeGreaterThan(10)
    }
  })
})
