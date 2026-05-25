/**
 * Vitest — Algo A1.3.3 conformity-score (clôture couverture 13/13 algos).
 *
 * Pure-fn qui consomme PropertyUnifiedProfile (A1.3.4) + MissionContext.
 * Cross-utilise A1.3.1 (DPE shopping) et A1.3.2 (cadastre coherence)
 * via les imports internes.
 */

import type { PropertyUnifiedProfile } from '@/lib/property/unified-profile'
import { describe, expect, it } from 'vitest'
import { type MissionContextForConformity, computeConformityScore } from './conformity-score'

function fixtureProfile(
  overrides: {
    surface_bati?: number | null
    dpeHistory?: PropertyUnifiedProfile['dpe_history']
    erpNaturels?: string[]
  } = {},
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
    parcelle:
      overrides.surface_bati === undefined
        ? null
        : {
            id: 'AB-0250',
            surface_terrain_m2: 250,
            surface_bati_m2: overrides.surface_bati,
            year_built_estimated: 1985,
            building_type: 'maison',
          },
    transactions: [],
    dpe_history: overrides.dpeHistory ?? [],
    erp_risks: {
      naturels: overrides.erpNaturels ?? [],
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

function baseMission(
  overrides: Partial<MissionContextForConformity> = {},
): MissionContextForConformity {
  return {
    diagnostic_type: 'DPE',
    declared_surface_m2: 95,
    estimated_dpe_class: null,
    has_photos: true,
    photos_count: 10,
    has_reserves_mentioned: true,
    required_fields_filled: 20,
    required_fields_total: 20,
    ...overrides,
  }
}

describe('computeConformityScore', () => {
  it('returns global_score 100 with perfect inputs', () => {
    const res = computeConformityScore(fixtureProfile(), baseMission())
    expect(res.global_score).toBe(100)
    expect(res.breakdown.coherence).toBe(100)
    expect(res.breakdown.ademe_risk).toBe(100)
    expect(res.breakdown.litigation_risk).toBe(100)
    expect(res.breakdown.completude).toBe(100)
    expect(res.anomalies).toHaveLength(0)
  })

  it('drops coherence -30 on cadastre gap >= 25% (warning)', () => {
    const res = computeConformityScore(
      fixtureProfile({ surface_bati: 100 }),
      baseMission({ declared_surface_m2: 130 }), // 30% gap
    )
    expect(res.breakdown.coherence).toBe(70)
    expect(res.anomalies.find((a) => a.id === 'cadastre-gap-warning')).toBeDefined()
  })

  it('drops coherence -10 on cadastre gap 15-25% (info)', () => {
    const res = computeConformityScore(
      fixtureProfile({ surface_bati: 100 }),
      baseMission({ declared_surface_m2: 118 }), // 18% gap
    )
    expect(res.breakdown.coherence).toBe(90)
    expect(res.anomalies.find((a) => a.id === 'cadastre-gap-info')).toBeDefined()
  })

  it('keeps coherence 100 when cadastre is null', () => {
    const res = computeConformityScore(fixtureProfile(), baseMission())
    expect(res.breakdown.coherence).toBe(100)
  })

  it('drops ademe_risk -40 on DPE shopping warning (gap >= 3)', () => {
    const recent = new Date()
    recent.setMonth(recent.getMonth() - 4)
    const res = computeConformityScore(
      fixtureProfile({
        dpeHistory: [
          {
            date: recent.toISOString(),
            class_dpe: 'F',
            class_ges: 'F',
            surface_m2: 95,
            methode: '3CL-2021',
            ademe_dpe_id: 'recent1',
          },
        ],
      }),
      baseMission({ estimated_dpe_class: 'C' }), // gap 3
    )
    expect(res.breakdown.ademe_risk).toBe(60)
    expect(res.anomalies.find((a) => a.id === 'dpe-shopping-warning')).toBeDefined()
  })

  it('drops ademe_risk -15 on DPE shopping info (gap == 2)', () => {
    const recent = new Date()
    recent.setMonth(recent.getMonth() - 3)
    const res = computeConformityScore(
      fixtureProfile({
        dpeHistory: [
          {
            date: recent.toISOString(),
            class_dpe: 'E',
            class_ges: 'E',
            surface_m2: 95,
            methode: '3CL-2021',
            ademe_dpe_id: 'recent2',
          },
        ],
      }),
      baseMission({ estimated_dpe_class: 'C' }), // gap 2
    )
    expect(res.breakdown.ademe_risk).toBe(85)
    expect(res.anomalies.find((a) => a.id === 'dpe-shopping-info')).toBeDefined()
  })

  it('drops litigation_risk -30 when < 5 photos', () => {
    const res = computeConformityScore(fixtureProfile(), baseMission({ photos_count: 2 }))
    expect(res.breakdown.litigation_risk).toBe(70)
    expect(res.anomalies.find((a) => a.id === 'photos-insufficient')).toBeDefined()
  })

  it('opens opportunity "add-reserves" when reserves missing (non-Carrez)', () => {
    const res = computeConformityScore(
      fixtureProfile(),
      baseMission({ has_reserves_mentioned: false, diagnostic_type: 'DPE' }),
    )
    expect(res.opportunities.find((o) => o.id === 'add-reserves')).toBeDefined()
  })

  it('does not flag reserves for Carrez diagnostic', () => {
    const res = computeConformityScore(
      fixtureProfile(),
      baseMission({ has_reserves_mentioned: false, diagnostic_type: 'CARREZ' }),
    )
    expect(res.opportunities.find((o) => o.id === 'add-reserves')).toBeUndefined()
  })

  it('computes completude proportionally to filled/total', () => {
    const res = computeConformityScore(
      fixtureProfile(),
      baseMission({ required_fields_filled: 14, required_fields_total: 20 }), // 70%
    )
    expect(res.breakdown.completude).toBe(70)
    expect(res.anomalies.find((a) => a.id === 'completude-low')).toBeDefined()
  })

  it('flags completude as warning if < 60%', () => {
    const res = computeConformityScore(
      fixtureProfile(),
      baseMission({ required_fields_filled: 9, required_fields_total: 20 }), // 45%
    )
    const completudeAnomaly = res.anomalies.find((a) => a.id === 'completude-low')
    expect(completudeAnomaly?.severity).toBe('warning')
  })

  it('proposes "first-dpe" opportunity when no DPE history', () => {
    const res = computeConformityScore(
      fixtureProfile({ dpeHistory: [] }),
      baseMission({ diagnostic_type: 'DPE' }),
    )
    expect(res.opportunities.find((o) => o.id === 'first-dpe')).toBeDefined()
  })

  it('proposes "erp-aligned" opportunity when ERP risks present + diagnostic ERP', () => {
    const res = computeConformityScore(
      fixtureProfile({ erpNaturels: ['inondation'] }),
      baseMission({ diagnostic_type: 'ERP' }),
    )
    expect(res.opportunities.find((o) => o.id === 'erp-aligned')).toBeDefined()
  })

  it('caps anomalies at 5 max', () => {
    const recent = new Date()
    recent.setMonth(recent.getMonth() - 2)
    const res = computeConformityScore(
      fixtureProfile({
        surface_bati: 100,
        dpeHistory: [
          {
            date: recent.toISOString(),
            class_dpe: 'F',
            class_ges: 'F',
            surface_m2: 100,
            methode: '3CL-2021',
            ademe_dpe_id: 'r',
          },
        ],
      }),
      baseMission({
        declared_surface_m2: 140, // cadastre gap warning
        photos_count: 1, // photos insufficient
        has_reserves_mentioned: false,
        estimated_dpe_class: 'B', // shopping warning
        required_fields_filled: 5,
        required_fields_total: 20, // completude warning
      }),
    )
    expect(res.anomalies.length).toBeLessThanOrEqual(5)
  })

  it('caps opportunities at 3 max', () => {
    const res = computeConformityScore(
      fixtureProfile({ dpeHistory: [], erpNaturels: ['inondation'] }),
      baseMission({
        has_reserves_mentioned: false,
        diagnostic_type: 'DPE',
      }),
    )
    expect(res.opportunities.length).toBeLessThanOrEqual(3)
  })

  it('weights global_score correctly (30% coherence + 30% ademe + 20% litig + 20% completude)', () => {
    // Coherence 60 (cadastre gap warning -30) + ademe 100 + litig 100 + completude 100
    // = 60*0.3 + 100*0.3 + 100*0.2 + 100*0.2 = 18 + 30 + 20 + 20 = 88
    const res = computeConformityScore(
      fixtureProfile({ surface_bati: 100 }),
      baseMission({ declared_surface_m2: 140 }),
    )
    expect(res.breakdown.coherence).toBe(70) // wait, single warning is -30 from 100 = 70, not 60
    expect(res.global_score).toBe(Math.round(70 * 0.3 + 100 * 0.3 + 100 * 0.2 + 100 * 0.2))
  })
})
