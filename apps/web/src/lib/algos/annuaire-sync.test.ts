/**
 * Vitest — Algo A1.3.8 annuaire sync.
 */

import { describe, expect, it } from 'vitest'
import { type AnnuaireSyncInput, syncAnnuaireDiagnostician } from './annuaire-sync'

const REF_DATE = new Date('2026-06-01T12:00:00Z')

function baseInput(overrides: Partial<AnnuaireSyncInput> = {}): AnnuaireSyncInput {
  return {
    dhup_last_synced_at: '2026-05-25', // 7 jours
    sirene_state: 'active',
    gmb_rating: 4.6,
    gmb_review_count: 38,
    cofrac_valid_count: 3,
    reference_date: REF_DATE,
    ...overrides,
  }
}

describe('syncAnnuaireDiagnostician', () => {
  it('returns max score for fully verified diagnostician', () => {
    const res = syncAnnuaireDiagnostician(baseInput())
    expect(res.activity_score).toBe(1.0)
    expect(res.score_breakdown.dhup_active.passed).toBe(true)
    expect(res.score_breakdown.sirene_active.passed).toBe(true)
    expect(res.score_breakdown.gmb_present.passed).toBe(true)
    expect(res.score_breakdown.cofrac_valid.passed).toBe(true)
    expect(res.should_hide_from_public).toBe(false)
    expect(res.recommended_action).toBe('visible')
    // Pas de fraud signal critique
    expect(res.fraud_signals.find((s) => s.severity === 'critical')).toBeUndefined()
  })

  it('flags SIRET closed as critical + auto_suspend', () => {
    const res = syncAnnuaireDiagnostician(baseInput({ sirene_state: 'closed' }))
    expect(res.score_breakdown.sirene_active.passed).toBe(false)
    expect(res.activity_score).toBe(0.7) // 0.4 dhup + 0.2 gmb + 0.1 cofrac
    expect(res.recommended_action).toBe('auto_suspend')
    expect(res.should_hide_from_public).toBe(true)
    const sireneFraud = res.fraud_signals.find((s) => s.type === 'sirene_closed')
    expect(sireneFraud?.severity).toBe('critical')
  })

  it('flags DHUP stale > 60 days as warning', () => {
    const res = syncAnnuaireDiagnostician(
      baseInput({ dhup_last_synced_at: '2026-03-01' }), // ~92 jours
    )
    expect(res.score_breakdown.dhup_active.passed).toBe(false)
    expect(res.activity_score).toBe(0.6) // 0.3 sirene + 0.2 gmb + 0.1 cofrac
    const dhupFraud = res.fraud_signals.find((s) => s.type === 'dhup_stale')
    expect(dhupFraud?.severity).toBe('warning')
  })

  it('flags never-synced DHUP as critical', () => {
    const res = syncAnnuaireDiagnostician(baseInput({ dhup_last_synced_at: null }))
    expect(res.score_breakdown.dhup_active.passed).toBe(false)
    const dhupFraud = res.fraud_signals.find((s) => s.type === 'dhup_stale')
    expect(dhupFraud?.severity).toBe('critical')
  })

  it('flags GMB absence as info only', () => {
    const res = syncAnnuaireDiagnostician(baseInput({ gmb_rating: null, gmb_review_count: null }))
    expect(res.score_breakdown.gmb_present.passed).toBe(false)
    const gmbFraud = res.fraud_signals.find((s) => s.type === 'no_gmb_reputation')
    expect(gmbFraud?.severity).toBe('info')
  })

  it('hides from public when activity_score < 0.5', () => {
    const res = syncAnnuaireDiagnostician(
      baseInput({
        dhup_last_synced_at: null,
        gmb_rating: 0,
        gmb_review_count: 0,
      }),
    )
    expect(res.activity_score).toBe(0.4) // 0.3 sirene + 0.1 cofrac
    expect(res.should_hide_from_public).toBe(true)
    expect(res.fraud_signals.find((s) => s.type === 'low_activity')).toBeDefined()
  })

  it('returns hide_pending_review when score < 0.3', () => {
    const res = syncAnnuaireDiagnostician({
      dhup_last_synced_at: null,
      sirene_state: 'unknown',
      gmb_rating: null,
      gmb_review_count: null,
      cofrac_valid_count: 1, // seul signal positif
      reference_date: REF_DATE,
    })
    expect(res.activity_score).toBe(0.1)
    expect(res.recommended_action).toBe('hide_pending_review')
  })

  it('action priority : sirene_closed override score-based action', () => {
    const res = syncAnnuaireDiagnostician(
      baseInput({ sirene_state: 'closed', cofrac_valid_count: 5 }),
    )
    // Score reste 0.7 (dhup + gmb + cofrac) mais SIRET closed → auto_suspend
    expect(res.recommended_action).toBe('auto_suspend')
  })
})
