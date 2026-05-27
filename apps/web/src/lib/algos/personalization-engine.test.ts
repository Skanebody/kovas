import { describe, expect, it } from 'vitest'
import { type PersonalizationInput, personalizeExperience } from './personalization-engine'

const baseInput: PersonalizationInput = {
  cluster: 'power_user',
  health_score: 75,
  underused_features: ['analytics_dashboard'],
  tenure_months: 8,
  onboarding_completed: true,
  tier: 'pro',
  has_annuaire: true,
  invoiced_this_month: true,
}

describe('personalizeExperience', () => {
  it('power_user healthy → widgets focus production + gain_tracker', () => {
    const result = personalizeExperience(baseInput)
    expect(result.health_bucket).toBe('healthy')
    expect(result.notification_frequency).toBe('normal')
    expect(result.dashboard_widgets).toContain('today_actions')
    expect(result.dashboard_widgets).toContain('cross_check_panel')
    expect(result.dashboard_widgets).toContain('gain_tracker')
    expect(result.dashboard_widgets).toContain('annuaire_stats') // has_annuaire=true
    expect(result.dashboard_widgets).toContain('parrainage_card') // healthy + tenure ok
  })

  it('cabinet_team → widgets focus équipe (team_activity + analytics)', () => {
    const result = personalizeExperience({
      ...baseInput,
      cluster: 'cabinet_team',
      tier: 'cabinet',
    })
    expect(result.dashboard_widgets).toContain('team_activity')
    expect(result.dashboard_widgets).toContain('analytics_summary')
    expect(result.dashboard_widgets).toContain('invoices_due')
  })

  it('new_user sans onboarding complet → onboarding_progress en premier widget', () => {
    const result = personalizeExperience({
      ...baseInput,
      cluster: 'new_user',
      onboarding_completed: false,
      tenure_months: 0,
    })
    expect(result.dashboard_widgets[0]).toBe('onboarding_progress')
  })

  it('churning → minimal widgets + notif minimal (health < 40)', () => {
    const result = personalizeExperience({
      ...baseInput,
      cluster: 'churning',
      health_score: 30,
    })
    expect(result.health_bucket).toBe('critical')
    expect(result.notification_frequency).toBe('minimal')
    // Pas de parrainage_card pour un churning low health
    expect(result.dashboard_widgets).not.toContain('parrainage_card')
  })

  it('promoter (health ≥ 80) → notif normal (pas overload)', () => {
    const result = personalizeExperience({ ...baseInput, health_score: 85 })
    expect(result.health_bucket).toBe('promoter')
    expect(result.notification_frequency).toBe('normal')
  })

  it('at_risk (40 ≤ health < 60) → notif reduced', () => {
    const result = personalizeExperience({ ...baseInput, health_score: 45 })
    expect(result.health_bucket).toBe('at_risk')
    expect(result.notification_frequency).toBe('reduced')
  })

  it('suggested_features : annuaire pushed en première pour Pro sans annuaire actif', () => {
    const result = personalizeExperience({
      ...baseInput,
      has_annuaire: false,
      underused_features: ['cross_check_6_sources'],
    })
    expect(result.suggested_features[0]).toBe('annuaire_fiche')
  })

  it('suggested_features capé à 3', () => {
    const result = personalizeExperience({
      ...baseInput,
      underused_features: [
        'voice_capture',
        'cross_check_6_sources',
        'liciel_export',
        'analytics_dashboard',
        'devis_module',
      ],
    })
    expect(result.suggested_features.length).toBeLessThanOrEqual(3)
  })

  it('suggested_features classées par priorité du cluster', () => {
    const result = personalizeExperience({
      ...baseInput,
      cluster: 'power_user',
      underused_features: ['analytics_dashboard', 'voice_capture'],
    })
    // power_user → voice_capture priorité 10 > analytics_dashboard priorité 8
    expect(result.suggested_features.indexOf('voice_capture')).toBeLessThan(
      result.suggested_features.indexOf('analytics_dashboard'),
    )
  })

  it('content_recommendations pour new_user sans onboarding → tutoriels basiques', () => {
    const result = personalizeExperience({
      ...baseInput,
      cluster: 'new_user',
      onboarding_completed: false,
    })
    expect(result.content_recommendations).toContain('getting_started')
    expect(result.content_recommendations).toContain('mission_workflow')
  })

  it('content_recommendations pour cabinet_team → cabinet_setup + tax_facture_x', () => {
    const result = personalizeExperience({
      ...baseInput,
      cluster: 'cabinet_team',
      tier: 'cabinet',
    })
    expect(result.content_recommendations).toContain('cabinet_setup')
    expect(result.content_recommendations).toContain('tax_facture_x')
  })

  it('churning → 2 sujets contenu seulement (ne pas overwhelm)', () => {
    const result = personalizeExperience({
      ...baseInput,
      cluster: 'churning',
      health_score: 30,
    })
    expect(result.content_recommendations).toHaveLength(2)
  })

  it('user sans annuaire → pas de widget annuaire_stats', () => {
    const result = personalizeExperience({ ...baseInput, has_annuaire: false })
    expect(result.dashboard_widgets).not.toContain('annuaire_stats')
    expect(result.dashboard_widgets).not.toContain('leads_inbox')
  })

  it('parrainage_card affiché seulement si tenure ≥ 1 mois ET healthy', () => {
    const newUser = personalizeExperience({
      ...baseInput,
      tenure_months: 0,
      health_score: 80,
    })
    expect(newUser.dashboard_widgets).not.toContain('parrainage_card')

    const matureLowHealth = personalizeExperience({
      ...baseInput,
      tenure_months: 6,
      health_score: 50,
    })
    expect(matureLowHealth.dashboard_widgets).not.toContain('parrainage_card')

    const matureHealthy = personalizeExperience({
      ...baseInput,
      tenure_months: 6,
      health_score: 70,
    })
    expect(matureHealthy.dashboard_widgets).toContain('parrainage_card')
  })

  it('human_message contient cluster + bucket + nombre widgets', () => {
    const result = personalizeExperience(baseInput)
    expect(result.human_message).toContain('Power user')
    expect(result.human_message).toContain('healthy')
    expect(result.human_message).toContain(String(result.dashboard_widgets.length))
  })
})
