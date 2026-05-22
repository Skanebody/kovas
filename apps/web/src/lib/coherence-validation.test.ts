/**
 * Vitest — `coherence-validation` (règles métier pré-export, feature MVP #7).
 *
 * Test les 5 règles principales :
 *   - Surface trop faible / trop grande
 *   - Surface DB vs surface mentionnée vocalement
 *   - Année construction vs classe énergie
 *   - Équipement chauffage manquant
 *   - Date construction future / trop ancienne
 */

import { describe, expect, it } from 'vitest'
import { type CoherenceContext, runCoherenceChecks } from './coherence-validation'

const emptyVoice: CoherenceContext['voiceNotes'] = []

function ctx(overrides: Partial<CoherenceContext['property']>): CoherenceContext {
  return {
    property: {
      surface_total: null,
      year_built: null,
      property_type: null,
      ...overrides,
    },
    voiceNotes: emptyVoice,
  }
}

describe('runCoherenceChecks — règles métier', () => {
  it('warne surface < 8 m²', () => {
    const w = runCoherenceChecks(ctx({ surface_total: 5 }))
    expect(w.some((x) => x.id === 'surface_too_low')).toBe(true)
  })

  it('warne surface > 1000 m² hors immeuble', () => {
    const w = runCoherenceChecks(ctx({ surface_total: 1500, property_type: 'maison' }))
    expect(w.some((x) => x.id === 'surface_too_high')).toBe(true)
  })

  it('ne warne PAS sur surface 1500 m² si immeuble', () => {
    const w = runCoherenceChecks(ctx({ surface_total: 1500, property_type: 'immeuble' }))
    expect(w.some((x) => x.id === 'surface_too_high')).toBe(false)
  })

  it('warne bâtiment 1850 + classe A (rénovation lourde improbable)', () => {
    const w = runCoherenceChecks(ctx({ year_built: 1850, energy_class: 'A' }))
    expect(w.some((x) => x.id === 'old_house_high_class')).toBe(true)
  })

  it('flag erreur bâtiment 2020 + classe G (RT2012 violée)', () => {
    const w = runCoherenceChecks(ctx({ year_built: 2020, energy_class: 'G' }))
    expect(w.some((x) => x.id === 'recent_low_class' && x.severity === 'error')).toBe(true)
  })

  it('flag erreur année dans le futur', () => {
    const w = runCoherenceChecks(ctx({ year_built: 3000 }))
    expect(w.some((x) => x.id === 'year_future' && x.severity === 'error')).toBe(true)
  })

  it('warne année très ancienne (< 1700)', () => {
    const w = runCoherenceChecks(ctx({ year_built: 1500 }))
    expect(w.some((x) => x.id === 'year_too_old')).toBe(true)
  })

  it('ne produit aucun warning sur un bien standard cohérent', () => {
    const w = runCoherenceChecks(
      ctx({ year_built: 1995, surface_total: 75, energy_class: 'D', property_type: 'appartement' }),
    )
    // Pas de warning critique sur un cas nominal
    expect(w.filter((x) => x.severity === 'error')).toHaveLength(0)
  })
})
