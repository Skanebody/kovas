/**
 * Vitest — Algo A1.3.1 DPE shopping detection.
 */

import type { PropertyUnifiedProfile } from '@/lib/property/unified-profile'
import { describe, expect, it } from 'vitest'
import { detectDpeShopping } from './dpe-shopping'

function fixtureProfile(
  dpeHistory: PropertyUnifiedProfile['dpe_history'] = [],
): PropertyUnifiedProfile {
  return {
    ban: {
      id: '76217_0250_00012',
      lat: 49.92,
      lng: 1.07,
      postcode: '76200',
      city: 'Dieppe',
      city_insee_code: '76217',
      department: '76',
    },
    parcelle: null,
    transactions: [],
    dpe_history: dpeHistory,
    erp_risks: {
      naturels: [],
      technologiques: [],
      miniers: [],
      radon_level: null,
      seismique: null,
    },
    diagnostiqueurs_zone: [],
    meta: {
      last_synced_at: new Date().toISOString(),
      source_versions: {},
      freshness_score: 1,
    },
  }
}

describe('detectDpeShopping', () => {
  it('returns has_recent_dpe=false when history is empty', () => {
    const res = detectDpeShopping(fixtureProfile(), 'D')
    expect(res.has_recent_dpe).toBe(false)
    expect(res.alert_level).toBe('none')
    expect(res.previous_class).toBeNull()
  })

  it('ignores DPE older than 12 months', () => {
    const veryOld = new Date()
    veryOld.setFullYear(veryOld.getFullYear() - 2)
    const res = detectDpeShopping(
      fixtureProfile([
        {
          date: veryOld.toISOString(),
          class_dpe: 'F',
          class_ges: 'F',
          surface_m2: 80,
          methode: '3CL-2021',
          ademe_dpe_id: 'old1',
        },
      ]),
      'D',
    )
    expect(res.has_recent_dpe).toBe(false)
  })

  it('returns warning alert for gap >= 3 classes', () => {
    const recent = new Date()
    recent.setMonth(recent.getMonth() - 4) // 4 mois
    const res = detectDpeShopping(
      fixtureProfile([
        {
          date: recent.toISOString(),
          class_dpe: 'F',
          class_ges: 'F',
          surface_m2: 80,
          methode: '3CL-2021',
          ademe_dpe_id: 'recent1',
        },
      ]),
      'C', // F=6, C=3 → gap 3
    )
    expect(res.has_recent_dpe).toBe(true)
    expect(res.previous_class).toBe('F')
    expect(res.alert_level).toBe('warning')
    expect(res.class_gap).toBe(3)
    expect(res.user_message).toContain('contrôle ADEME')
  })

  it('returns info alert for gap >= 2 classes', () => {
    const recent = new Date()
    recent.setMonth(recent.getMonth() - 2)
    const res = detectDpeShopping(
      fixtureProfile([
        {
          date: recent.toISOString(),
          class_dpe: 'E',
          class_ges: 'E',
          surface_m2: 80,
          methode: '3CL-2021',
          ademe_dpe_id: 'recent2',
        },
      ]),
      'C', // E=5, C=3 → gap 2
    )
    expect(res.alert_level).toBe('info')
    expect(res.class_gap).toBe(2)
  })

  it('returns info alert when DPE recent and small or null gap', () => {
    const recent = new Date()
    recent.setDate(recent.getDate() - 60)
    const res = detectDpeShopping(
      fixtureProfile([
        {
          date: recent.toISOString(),
          class_dpe: 'D',
          class_ges: 'D',
          surface_m2: 95,
          methode: '3CL-2021',
          ademe_dpe_id: 'recent3',
        },
      ]),
      null,
    )
    expect(res.has_recent_dpe).toBe(true)
    expect(res.alert_level).toBe('info')
    expect(res.class_gap).toBeNull()
    expect(res.user_message).toContain('cohérence')
  })

  it('selects the most recent DPE when multiple', () => {
    const olderDate = new Date()
    olderDate.setMonth(olderDate.getMonth() - 11)
    const newerDate = new Date()
    newerDate.setMonth(newerDate.getMonth() - 1)
    const res = detectDpeShopping(
      fixtureProfile([
        {
          date: olderDate.toISOString(),
          class_dpe: 'G',
          class_ges: 'G',
          surface_m2: 80,
          methode: '3CL-2021',
          ademe_dpe_id: 'old',
        },
        {
          date: newerDate.toISOString(),
          class_dpe: 'D',
          class_ges: 'D',
          surface_m2: 80,
          methode: '3CL-2021',
          ademe_dpe_id: 'new',
        },
      ]),
      'C',
    )
    expect(res.previous_class).toBe('D')
    expect(res.class_gap).toBe(1)
  })
})
