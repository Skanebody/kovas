/**
 * Vitest — Algo A1.3.10 expiry predictor.
 *
 * Couvre les 5 niveaux d'urgence + recommended_action + champs NULL.
 */

import { describe, expect, it } from 'vitest'
import { predictExpiry } from './expiry-predictor'

// Date de référence fixe pour tests déterministes : 1er juin 2026
const REF_DATE = new Date('2026-06-01T12:00:00Z')

describe('predictExpiry', () => {
  it('returns safe when both dates are far in the future', () => {
    const res = predictExpiry({
      cofrac_valid_until: '2027-06-01',
      rcpro_valid_until: '2027-12-01',
      reference_date: REF_DATE,
    })
    expect(res.worst_urgency).toBe('safe')
    expect(res.recommended_action).toBe('none')
    expect(res.cofrac.days_until_expiry).toBe(365)
    expect(res.next_cert_to_renew).toBe('cofrac')
  })

  it('flags attention when expiry is between 30 and 60 days', () => {
    const res = predictExpiry({
      cofrac_valid_until: '2026-07-15', // ~44 jours
      rcpro_valid_until: '2027-06-01',
      reference_date: REF_DATE,
    })
    expect(res.cofrac.urgency).toBe('attention')
    expect(res.worst_urgency).toBe('attention')
    expect(res.recommended_action).toBe('remind_60')
  })

  it('flags urgent when expiry is between 7 and 30 days', () => {
    const res = predictExpiry({
      cofrac_valid_until: '2026-06-20', // 19 jours
      rcpro_valid_until: '2027-01-01',
      reference_date: REF_DATE,
    })
    expect(res.cofrac.urgency).toBe('urgent')
    expect(res.worst_urgency).toBe('urgent')
    expect(res.recommended_action).toBe('remind_30')
  })

  it('flags critical when expiry is within 7 days', () => {
    const res = predictExpiry({
      cofrac_valid_until: '2026-06-05', // 4 jours
      rcpro_valid_until: '2027-01-01',
      reference_date: REF_DATE,
    })
    expect(res.cofrac.urgency).toBe('critical')
    expect(res.recommended_action).toBe('urgent_remind_7')
  })

  it('flags expired when past the date', () => {
    const res = predictExpiry({
      cofrac_valid_until: '2026-05-15', // -17 jours
      rcpro_valid_until: '2027-01-01',
      reference_date: REF_DATE,
    })
    expect(res.cofrac.urgency).toBe('expired')
    expect(res.worst_urgency).toBe('expired')
    expect(res.recommended_action).toBe('block_expired')
    expect(res.cofrac.days_until_expiry).toBeLessThan(0)
  })

  it('selects the worst urgency between cofrac and rcpro', () => {
    const res = predictExpiry({
      cofrac_valid_until: '2027-06-01', // safe
      rcpro_valid_until: '2026-06-03', // critical (2j)
      reference_date: REF_DATE,
    })
    expect(res.cofrac.urgency).toBe('safe')
    expect(res.rcpro.urgency).toBe('critical')
    expect(res.worst_urgency).toBe('critical')
    expect(res.next_cert_to_renew).toBe('rcpro')
  })

  it('handles null dates gracefully', () => {
    const res = predictExpiry({
      cofrac_valid_until: null,
      rcpro_valid_until: null,
      reference_date: REF_DATE,
    })
    expect(res.cofrac.urgency).toBe('safe')
    expect(res.rcpro.urgency).toBe('safe')
    expect(res.next_cert_to_renew).toBeNull()
    expect(res.days_until_next_expiry).toBeNull()
  })

  it('handles mixed null + valid dates', () => {
    const res = predictExpiry({
      cofrac_valid_until: '2026-06-10', // 9 jours = urgent
      rcpro_valid_until: null,
      reference_date: REF_DATE,
    })
    expect(res.cofrac.urgency).toBe('urgent')
    expect(res.rcpro.urgency).toBe('safe')
    expect(res.worst_urgency).toBe('urgent')
    expect(res.next_cert_to_renew).toBe('cofrac')
  })

  it('returns a human message tailored to urgency', () => {
    const expired = predictExpiry({
      cofrac_valid_until: '2026-05-01',
      rcpro_valid_until: null,
      reference_date: REF_DATE,
    })
    expect(expired.human_message).toMatch(/expirée/i)

    const safe = predictExpiry({
      cofrac_valid_until: '2027-06-01',
      rcpro_valid_until: '2027-06-01',
      reference_date: REF_DATE,
    })
    expect(safe.human_message).toMatch(/à jour/i)
  })
})
