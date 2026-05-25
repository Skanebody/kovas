/**
 * Vitest — incremental recompute (cache invalidation intelligente, Lot B49).
 *
 * Pure-fn déterministes (zéro IO, zéro Math.random).
 */

import { describe, expect, it } from 'vitest'
import {
  type AnalysisType,
  FIELD_DEPENDENCIES,
  estimateRecomputeSavings,
  findAffectedAnalyses,
  fullRecomputeCostEur,
} from './incremental-recompute'

describe('FIELD_DEPENDENCIES carte', () => {
  it("contient au moins les 10 champs critiques d'une mission", () => {
    const required = [
      'year_built',
      'surface_carrez',
      'heating_type',
      'photos',
      'address',
      'postal_code',
      'diagnostic_type',
    ]
    for (const field of required) {
      expect(FIELD_DEPENDENCIES[field]).toBeDefined()
    }
  })

  it('toutes les analyses référencées sont des AnalysisType valides', () => {
    const validAnalyses: AnalysisType[] = [
      'conformity_score',
      'risk_ademe',
      'cadastre_check',
      'dpe_shopping_check',
      'dpe_class_prediction',
      'vision_equipment',
      'production_anomaly',
      'document_classification',
      'lead_scoring',
      'pattern_learning',
    ]
    const seen = new Set<string>()
    for (const deps of Object.values(FIELD_DEPENDENCIES)) {
      for (const a of deps) seen.add(a)
    }
    for (const a of seen) {
      expect(validAnalyses).toContain(a)
    }
  })

  it('year_built déclenche conformity + risk_ademe + cadastre + dpe_class_prediction', () => {
    expect(FIELD_DEPENDENCIES.year_built).toEqual([
      'conformity_score',
      'risk_ademe',
      'cadastre_check',
      'dpe_class_prediction',
    ])
  })

  it('photos déclenche vision_equipment + conformity + production_anomaly', () => {
    expect(FIELD_DEPENDENCIES.photos).toContain('vision_equipment')
    expect(FIELD_DEPENDENCIES.photos).toContain('conformity_score')
    expect(FIELD_DEPENDENCIES.photos).toContain('production_anomaly')
  })

  it('client_name est explicitement neutre (n’affecte aucune analyse)', () => {
    expect(FIELD_DEPENDENCIES.client_name).toEqual([])
  })
})

describe('findAffectedAnalyses', () => {
  it('retourne set vide pour 0 changement', () => {
    const r = findAffectedAnalyses([])
    expect(r.analyses).toEqual([])
    expect(r.estimated_cost_eur).toBe(0)
    expect(r.unmapped_fields).toEqual([])
  })

  it('retourne les bonnes analyses pour year_built changé seul', () => {
    const r = findAffectedAnalyses(['year_built'])
    expect(r.analyses).toContain('conformity_score')
    expect(r.analyses).toContain('risk_ademe')
    expect(r.analyses).toContain('cadastre_check')
    expect(r.analyses).toContain('dpe_class_prediction')
    expect(r.analyses).toHaveLength(4)
  })

  it('déduplique les analyses quand plusieurs champs déclenchent la même', () => {
    // year_built ET surface_carrez déclenchent tous les 2 conformity_score
    // → conformity_score ne doit apparaître qu'une seule fois
    const r = findAffectedAnalyses(['year_built', 'surface_carrez'])
    const conformityCount = r.analyses.filter((a) => a === 'conformity_score').length
    expect(conformityCount).toBe(1)
  })

  it('reporte les champs non mappés en unmapped_fields', () => {
    const r = findAffectedAnalyses(['champ_inexistant', 'year_built'])
    expect(r.unmapped_fields).toEqual(['champ_inexistant'])
    expect(r.analyses.length).toBeGreaterThan(0)
  })

  it('coût estimé est croissant avec nombre d’analyses', () => {
    const single = findAffectedAnalyses(['client_name']) // 0 analyses
    const dual = findAffectedAnalyses(['photos']) // ≥1 analyses
    const big = findAffectedAnalyses(['year_built', 'photos', 'heating_type']) // beaucoup

    expect(single.estimated_cost_eur).toBe(0)
    expect(dual.estimated_cost_eur).toBeGreaterThan(0)
    expect(big.estimated_cost_eur).toBeGreaterThanOrEqual(dual.estimated_cost_eur)
  })

  it('liste les analyses triées (déterminisme du test)', () => {
    const r = findAffectedAnalyses(['photos'])
    const sorted = [...r.analyses].sort()
    expect(r.analyses).toEqual(sorted)
  })

  it('champ neutre (client_email) ne déclenche aucune analyse', () => {
    const r = findAffectedAnalyses(['client_email'])
    expect(r.analyses).toEqual([])
    expect(r.unmapped_fields).toEqual([])
  })
})

describe('fullRecomputeCostEur', () => {
  it('retourne un coût total > 0', () => {
    expect(fullRecomputeCostEur()).toBeGreaterThan(0)
  })

  it("est >= au coût d'une analyse individuelle quelconque", () => {
    const yearBuiltCost = findAffectedAnalyses(['year_built']).estimated_cost_eur
    expect(fullRecomputeCostEur()).toBeGreaterThanOrEqual(yearBuiltCost)
  })
})

describe('estimateRecomputeSavings', () => {
  it('zero savings if no edits', () => {
    const s = estimateRecomputeSavings({ totalEdits: 0, changedFieldsPerEdit: 3 })
    expect(s.baseline_cost_eur).toBe(0)
    expect(s.saved_eur).toBe(0)
  })

  it('full recompute (10+ champs changés) ne génère plus d’économie', () => {
    const s = estimateRecomputeSavings({
      totalEdits: 1000,
      changedFieldsPerEdit: 10, // 10 × 2 = 20 analyses (cappé à 10 max)
    })
    // saved_eur >= 0 mais saved_pct doit être proche de 0 (recompute complet)
    expect(s.saved_pct).toBeLessThan(10)
  })

  it('1 seul champ changé → grosse économie (~80%+)', () => {
    const s = estimateRecomputeSavings({
      totalEdits: 1000,
      changedFieldsPerEdit: 1, // 1 × 2 = 2 analyses sur 10 → 80% économie
    })
    expect(s.saved_pct).toBeGreaterThan(70)
    expect(s.saved_pct).toBeLessThan(90)
  })

  it('clamp changedFieldsPerEdit à >= 0 (négatif traité comme 0)', () => {
    const s = estimateRecomputeSavings({ totalEdits: 100, changedFieldsPerEdit: -5 })
    // 0 champ changé → 0 recompute incremental → 100% économie
    expect(s.incremental_cost_eur).toBe(0)
    expect(s.saved_pct).toBe(100)
  })

  it('baseline correspond au coût full × nombre d’édits', () => {
    const s = estimateRecomputeSavings({ totalEdits: 100, changedFieldsPerEdit: 1 })
    expect(s.baseline_cost_eur).toBeCloseTo(100 * fullRecomputeCostEur(), 4)
  })
})
