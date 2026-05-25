/**
 * Vitest — Algo A1.3.9 production anomaly detection.
 */

import { describe, expect, it } from 'vitest'
import { type ProductionAnomalyInput, detectProductionAnomalies } from './production-anomaly'

function baseInput(overrides: Partial<ProductionAnomalyInput> = {}): ProductionAnomalyInput {
  return {
    declared_energy_class: 'D',
    declared_ges_class: 'D',
    declared_consumption_kwhep_m2_year: 220, // dans la plage D (181-250)
    surface_m2: 95,
    property_type: 'appartement',
    year_built: 1990,
    previous_dpe_class_same_parcel: null,
    months_since_previous_dpe: null,
    commune_passoires_pct: 18,
    ...overrides,
  }
}

describe('detectProductionAnomalies', () => {
  it('returns no anomalies for a coherent DPE', () => {
    const res = detectProductionAnomalies(baseInput())
    expect(res.anomalies).toHaveLength(0)
    expect(res.recommended_action).toBe('publish')
    expect(res.block_publication).toBe(false)
  })

  it('flags consumption critically incoherent with class', () => {
    const res = detectProductionAnomalies(
      baseInput({
        declared_energy_class: 'A',
        declared_consumption_kwhep_m2_year: 250, // hors plage A (0-70)
      }),
    )
    const found = res.anomalies.find((a) => a.code === 'CONSUMPTION_INCOHERENT_WITH_CLASS')
    expect(found).toBeDefined()
    expect(found?.severity).toBe('critical')
    expect(res.block_publication).toBe(true)
    expect(res.recommended_action).toBe('rework')
  })

  it('flags GES vs energy gap >= 4 classes as warning', () => {
    const res = detectProductionAnomalies(
      baseInput({
        declared_energy_class: 'A',
        declared_ges_class: 'E',
        declared_consumption_kwhep_m2_year: 50, // valide pour A
      }),
    )
    const found = res.anomalies.find((a) => a.code === 'GES_ENERGY_GAP_HIGH')
    expect(found).toBeDefined()
    expect(found?.severity).toBe('warning')
  })

  it('flags GES vs energy gap >= 5 classes as critical', () => {
    const res = detectProductionAnomalies(
      baseInput({
        declared_energy_class: 'A',
        declared_ges_class: 'F',
        declared_consumption_kwhep_m2_year: 50,
      }),
    )
    const found = res.anomalies.find((a) => a.code === 'GES_ENERGY_GAP_HIGH')
    expect(found?.severity).toBe('critical')
  })

  it('flags previous DPE jump >= 4 classes as critical (DPE shopping signal)', () => {
    const res = detectProductionAnomalies(
      baseInput({
        declared_energy_class: 'B',
        declared_consumption_kwhep_m2_year: 90,
        previous_dpe_class_same_parcel: 'F',
        months_since_previous_dpe: 6,
      }),
    )
    const found = res.anomalies.find((a) => a.code === 'PREVIOUS_DPE_BIG_JUMP')
    expect(found).toBeDefined()
    expect(found?.severity).toBe('critical')
  })

  it('flags pre-1949 class A or B as warning', () => {
    const res = detectProductionAnomalies(
      baseInput({
        declared_energy_class: 'A',
        declared_consumption_kwhep_m2_year: 50,
        year_built: 1880,
      }),
    )
    const found = res.anomalies.find((a) => a.code === 'PRE_1949_CLASS_A_OR_B_SUSPECT')
    expect(found?.severity).toBe('warning')
  })

  it('flags surface NULL as warning', () => {
    const res = detectProductionAnomalies(baseInput({ surface_m2: null }))
    const found = res.anomalies.find((a) => a.code === 'SURFACE_NULL')
    expect(found?.severity).toBe('warning')
    expect(res.recommended_action).toBe('justify_before_publish')
  })

  it('flags local distribution outlier as info only', () => {
    const res = detectProductionAnomalies(
      baseInput({
        declared_energy_class: 'A',
        declared_consumption_kwhep_m2_year: 50,
        commune_passoires_pct: 55,
        year_built: 2010, // pas pre-1949 pour éviter cumul
      }),
    )
    const found = res.anomalies.find((a) => a.code === 'LOCAL_DISTRIBUTION_OUTLIER')
    expect(found?.severity).toBe('info')
  })
})
