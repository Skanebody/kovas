/**
 * Vitest — Algo A1.3.2 cohérence cadastre vs surface déclarée.
 */

import type { PropertyUnifiedProfile } from '@/lib/property/unified-profile'
import { describe, expect, it } from 'vitest'
import { checkCadastreCoherence } from './cadastre-coherence'

function fixtureProfile(cadastreSurface: number | null): PropertyUnifiedProfile {
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
      cadastreSurface === null
        ? null
        : {
            id: 'AB-0250',
            surface_terrain_m2: 250,
            surface_bati_m2: cadastreSurface,
            year_built_estimated: 1985,
            building_type: 'maison',
          },
    transactions: [],
    dpe_history: [],
    erp_risks: {
      naturels: [],
      technologiques: [],
      miniers: [],
      radon_level: null,
      seismique: null,
    },
    diagnostiqueurs_zone: [],
    meta: { last_synced_at: new Date().toISOString(), source_versions: {}, freshness_score: 1 },
  }
}

describe('checkCadastreCoherence', () => {
  it('returns no alert when surfaces match', () => {
    const res = checkCadastreCoherence(fixtureProfile(100), 102) // gap 2%
    expect(res.alert).toBe(false)
    expect(res.alert_level).toBe('none')
    expect(res.cadastre_surface_m2).toBe(100)
  })

  it('returns warning when gap >= 25%', () => {
    const res = checkCadastreCoherence(fixtureProfile(100), 130) // gap 30%
    expect(res.alert_level).toBe('warning')
    expect(res.alert).toBe(true)
    expect(res.gap_pct).toBeCloseTo(0.3, 2)
    expect(res.suggested_action).toContain('30%')
  })

  it('returns info when gap >= 15% but < 25%', () => {
    const res = checkCadastreCoherence(fixtureProfile(100), 118) // gap 18%
    expect(res.alert_level).toBe('info')
    expect(res.alert).toBe(true)
  })

  it('returns no alert when cadastre surface is null', () => {
    const res = checkCadastreCoherence(fixtureProfile(null), 95)
    expect(res.alert).toBe(false)
    expect(res.gap_pct).toBeNull()
    expect(res.cadastre_surface_m2).toBeNull()
  })

  it('returns no alert when declared surface <= 0', () => {
    const res = checkCadastreCoherence(fixtureProfile(100), 0)
    expect(res.alert).toBe(false)
  })
})
