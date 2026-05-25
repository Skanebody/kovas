/**
 * Vitest — Lot B59 : User knowledge graph sémantique (pure-fn).
 *
 * Couvre buildKnowledgeGraph (cas vide / 1 / N missions), predictFromGraph
 * (cold start, mature, zone-aware, equipment), computeDelta (0/10/50/100%)
 * et routeAnalysisStrategy (3 stratégies + edge cases threshold).
 */

import { describe, expect, it } from 'vitest'
import {
  type MissionLite,
  type UserKnowledgeGraph,
  buildKnowledgeGraph,
  computeDelta,
  predictFromGraph,
  routeAnalysisStrategy,
} from './user-knowledge-graph'

const NOW = '2026-05-25T10:00:00.000Z'

function mission(overrides: Partial<MissionLite> = {}): MissionLite {
  return {
    id: 'm-default',
    created_at: '2026-05-01T10:00:00.000Z',
    postal_code: '75008',
    property_type: 'appartement',
    year_built: 1990,
    surface_m2: 65,
    dpe_class: 'D',
    equipment_brands: ['Atlantic', 'Saunier Duval'],
    anomaly_patterns: ['DPE D + chaudière gaz neuve'],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildKnowledgeGraph
// ---------------------------------------------------------------------------

describe('buildKnowledgeGraph', () => {
  it('returns stable empty graph for zero missions', () => {
    const g = buildKnowledgeGraph([], NOW)
    expect(g.sample_size).toBe(0)
    expect(g.last_updated_at).toBe(NOW)
    expect(g.frequent_equipment_brands).toEqual([])
    expect(g.frequent_postal_codes).toEqual([])
    expect(g.frequent_property_types).toEqual([])
    expect(g.avg_year_built).toBeNull()
    expect(g.avg_surface_m2).toBeNull()
    expect(g.recurring_anomaly_patterns).toEqual([])
    expect(g.dpe_class_distribution).toEqual({ A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 })
  })

  it('aggregates a single mission correctly', () => {
    const g = buildKnowledgeGraph([mission({ id: 'm1' })], NOW)
    expect(g.sample_size).toBe(1)
    expect(g.frequent_postal_codes).toEqual([{ postal_code: '75008', count: 1 }])
    expect(g.frequent_property_types).toEqual([{ type: 'appartement', count: 1 }])
    expect(g.dpe_class_distribution.D).toBe(1)
    expect(g.avg_year_built).toBe(1990)
    expect(g.avg_surface_m2).toBe(65)
    expect(g.frequent_equipment_brands).toHaveLength(2)
    // single-shot anomaly filtered out (need count >= 2)
    expect(g.recurring_anomaly_patterns).toEqual([])
  })

  it('counts equipment brands and tracks last_seen as latest date', () => {
    const missions: MissionLite[] = [
      mission({
        id: 'm1',
        created_at: '2026-01-15T00:00:00.000Z',
        equipment_brands: ['Atlantic'],
      }),
      mission({
        id: 'm2',
        created_at: '2026-03-20T00:00:00.000Z',
        equipment_brands: ['Atlantic', 'Bosch'],
      }),
      mission({
        id: 'm3',
        created_at: '2026-02-10T00:00:00.000Z',
        equipment_brands: ['Atlantic'],
      }),
    ]
    const g = buildKnowledgeGraph(missions, NOW)
    const atlantic = g.frequent_equipment_brands.find((b) => b.brand === 'Atlantic')
    expect(atlantic).toBeDefined()
    expect(atlantic?.count).toBe(3)
    expect(atlantic?.last_seen).toBe('2026-03-20T00:00:00.000Z')
  })

  it('caps frequent_equipment_brands at top 10 sorted by count desc', () => {
    const missions: MissionLite[] = []
    // 15 unique brands, counts 15, 14, 13, ... 1
    for (let i = 0; i < 15; i++) {
      for (let j = 0; j <= 15 - i; j++) {
        missions.push(mission({ id: `m-${i}-${j}`, equipment_brands: [`Brand-${i}`] }))
      }
    }
    const g = buildKnowledgeGraph(missions, NOW)
    expect(g.frequent_equipment_brands).toHaveLength(10)
    expect(g.frequent_equipment_brands[0]?.brand).toBe('Brand-0')
    expect(g.frequent_equipment_brands[0]?.count).toBe(16)
  })

  it('caps frequent_postal_codes at top 20', () => {
    const missions: MissionLite[] = []
    // 25 unique postal codes with decreasing counts
    for (let i = 0; i < 25; i++) {
      const pc = `7500${(i % 10).toString()}${Math.floor(i / 10)}`
      for (let j = 0; j <= 25 - i; j++) {
        missions.push(mission({ id: `m-${i}-${j}`, postal_code: pc }))
      }
    }
    const g = buildKnowledgeGraph(missions, NOW)
    expect(g.frequent_postal_codes).toHaveLength(20)
    expect(g.frequent_postal_codes[0]?.count).toBeGreaterThan(
      g.frequent_postal_codes[19]?.count ?? 0,
    )
  })

  it('ignores missions with null/missing fields without crashing', () => {
    const missions: MissionLite[] = [
      mission({ id: 'm1', postal_code: null, equipment_brands: null }),
      mission({ id: 'm2', year_built: null, surface_m2: null }),
      mission({ id: 'm3', dpe_class: null, anomaly_patterns: null }),
    ]
    const g = buildKnowledgeGraph(missions, NOW)
    expect(g.sample_size).toBe(3)
    // avgs based on only m1 + m3
    expect(g.avg_year_built).toBe(1990)
    expect(g.dpe_class_distribution.D).toBe(2)
  })

  it('counts dpe_class_distribution for all 7 classes', () => {
    const missions: MissionLite[] = [
      mission({ id: 'm1', dpe_class: 'A' }),
      mission({ id: 'm2', dpe_class: 'A' }),
      mission({ id: 'm3', dpe_class: 'C' }),
      mission({ id: 'm4', dpe_class: 'F' }),
      mission({ id: 'm5', dpe_class: 'G' }),
    ]
    const g = buildKnowledgeGraph(missions, NOW)
    expect(g.dpe_class_distribution).toEqual({ A: 2, B: 0, C: 1, D: 0, E: 0, F: 1, G: 1 })
  })

  it('computes avg_year_built and avg_surface_m2 as numeric means with 2 decimals', () => {
    const missions: MissionLite[] = [
      mission({ id: 'm1', year_built: 1980, surface_m2: 50 }),
      mission({ id: 'm2', year_built: 2000, surface_m2: 75 }),
      mission({ id: 'm3', year_built: 2020, surface_m2: 100 }),
    ]
    const g = buildKnowledgeGraph(missions, NOW)
    expect(g.avg_year_built).toBe(2000)
    expect(g.avg_surface_m2).toBe(75)
  })

  it('filters anomaly patterns with count < 2 (single-shot noise removal)', () => {
    const missions: MissionLite[] = [
      mission({ id: 'm1', anomaly_patterns: ['pattern-A', 'pattern-B'] }),
      mission({ id: 'm2', anomaly_patterns: ['pattern-A', 'pattern-C'] }),
      mission({ id: 'm3', anomaly_patterns: ['pattern-A'] }),
    ]
    const g = buildKnowledgeGraph(missions, NOW)
    expect(g.recurring_anomaly_patterns).toEqual([{ pattern: 'pattern-A', count: 3 }])
  })

  it('trims whitespace and ignores empty strings in brand/postal/anomaly inputs', () => {
    const missions: MissionLite[] = [
      mission({
        id: 'm1',
        postal_code: '  ',
        equipment_brands: ['  Atlantic  ', ''],
        anomaly_patterns: ['  ', 'pattern-X'],
      }),
      mission({
        id: 'm2',
        postal_code: '75008',
        equipment_brands: ['Atlantic'],
        anomaly_patterns: ['pattern-X'],
      }),
    ]
    const g = buildKnowledgeGraph(missions, NOW)
    expect(g.frequent_postal_codes).toEqual([{ postal_code: '75008', count: 1 }])
    const atlantic = g.frequent_equipment_brands.find((b) => b.brand === 'Atlantic')
    expect(atlantic?.count).toBe(2)
    expect(g.recurring_anomaly_patterns).toEqual([{ pattern: 'pattern-X', count: 2 }])
  })

  it('sorts property_types by count desc', () => {
    const missions: MissionLite[] = [
      ...Array.from({ length: 5 }, (_, i) => mission({ id: `mai-${i}`, property_type: 'maison' })),
      ...Array.from({ length: 10 }, (_, i) =>
        mission({ id: `app-${i}`, property_type: 'appartement' }),
      ),
      mission({ id: 'autre-1', property_type: 'autre' }),
    ]
    const g = buildKnowledgeGraph(missions, NOW)
    expect(g.frequent_property_types[0]).toEqual({ type: 'appartement', count: 10 })
    expect(g.frequent_property_types[1]).toEqual({ type: 'maison', count: 5 })
    expect(g.frequent_property_types[2]).toEqual({ type: 'autre', count: 1 })
  })

  it('output is JSON-serializable (round-trip equality)', () => {
    const missions: MissionLite[] = [mission({ id: 'm1' }), mission({ id: 'm2' })]
    const g = buildKnowledgeGraph(missions, NOW)
    const roundtrip = JSON.parse(JSON.stringify(g))
    expect(roundtrip).toEqual(g)
  })
})

// ---------------------------------------------------------------------------
// predictFromGraph
// ---------------------------------------------------------------------------

describe('predictFromGraph', () => {
  it('flags cold_start when sample_size < 10', () => {
    const missions = Array.from({ length: 5 }, (_, i) => mission({ id: `m-${i}` }))
    const g = buildKnowledgeGraph(missions, NOW)
    const p = predictFromGraph(g)
    expect(p.cold_start).toBe(true)
  })

  it('does not flag cold_start when sample_size >= 10', () => {
    const missions = Array.from({ length: 12 }, (_, i) => mission({ id: `m-${i}` }))
    const g = buildKnowledgeGraph(missions, NOW)
    const p = predictFromGraph(g)
    expect(p.cold_start).toBe(false)
  })

  it('returns null fields when graph is empty', () => {
    const g = buildKnowledgeGraph([], NOW)
    const p = predictFromGraph(g)
    expect(p.postal_code).toBeNull()
    expect(p.property_type).toBeNull()
    expect(p.dpe_class).toBeNull()
    expect(p.year_built).toBeNull()
    expect(p.surface_m2).toBeNull()
    expect(p.likely_equipment_brands).toEqual([])
    expect(p.overall_confidence).toBe(0)
    expect(p.cold_start).toBe(true)
  })

  it('predicts top postal_code with confidence proportional to frequency', () => {
    const missions: MissionLite[] = [
      ...Array.from({ length: 15 }, (_, i) => mission({ id: `pa-${i}`, postal_code: '75008' })),
      ...Array.from({ length: 5 }, (_, i) => mission({ id: `re-${i}`, postal_code: '76200' })),
    ]
    const g = buildKnowledgeGraph(missions, NOW)
    const p = predictFromGraph(g)
    expect(p.postal_code?.value).toBe('75008')
    expect(p.postal_code?.confidence).toBeCloseTo(0.75, 2)
  })

  it('predicts top property_type', () => {
    const missions = Array.from({ length: 20 }, (_, i) =>
      mission({ id: `m-${i}`, property_type: i < 15 ? 'maison' : 'appartement' }),
    )
    const g = buildKnowledgeGraph(missions, NOW)
    const p = predictFromGraph(g)
    expect(p.property_type?.value).toBe('maison')
    expect(p.property_type?.confidence).toBeCloseTo(0.75, 2)
  })

  it('predicts mode of dpe_class distribution', () => {
    const missions: MissionLite[] = [
      ...Array.from({ length: 10 }, (_, i) => mission({ id: `d-${i}`, dpe_class: 'D' })),
      ...Array.from({ length: 4 }, (_, i) => mission({ id: `e-${i}`, dpe_class: 'E' })),
      ...Array.from({ length: 2 }, (_, i) => mission({ id: `f-${i}`, dpe_class: 'F' })),
    ]
    const g = buildKnowledgeGraph(missions, NOW)
    const p = predictFromGraph(g)
    expect(p.dpe_class?.value).toBe('D')
    expect(p.dpe_class?.confidence).toBeCloseTo(0.63, 2)
  })

  it('returns top 3 likely equipment brands', () => {
    const missions: MissionLite[] = []
    for (let i = 0; i < 20; i++) {
      missions.push(
        mission({
          id: `m-${i}`,
          equipment_brands: ['Atlantic', i < 10 ? 'Bosch' : 'Saunier Duval', 'Vaillant'],
        }),
      )
    }
    const g = buildKnowledgeGraph(missions, NOW)
    const p = predictFromGraph(g)
    expect(p.likely_equipment_brands).toHaveLength(3)
    expect(p.likely_equipment_brands[0]?.value).toBe('Atlantic')
    expect(p.likely_equipment_brands[0]?.confidence).toBe(1)
  })

  it('uses missionInput.postal_code as confidence=1 hint (zone-aware)', () => {
    const missions = Array.from({ length: 20 }, (_, i) =>
      mission({ id: `m-${i}`, postal_code: '75008' }),
    )
    const g = buildKnowledgeGraph(missions, NOW)
    const p = predictFromGraph(g, { postal_code: '76600' })
    expect(p.postal_code?.value).toBe('76600')
    expect(p.postal_code?.confidence).toBe(1)
  })

  it('computes overall_confidence as average of predicted components', () => {
    const missions = Array.from({ length: 30 }, (_, i) => mission({ id: `m-${i}` }))
    const g = buildKnowledgeGraph(missions, NOW)
    const p = predictFromGraph(g)
    expect(p.overall_confidence).toBeGreaterThan(0)
    expect(p.overall_confidence).toBeLessThanOrEqual(1)
  })

  it('predicts integer year_built (rounded)', () => {
    const missions: MissionLite[] = [
      mission({ id: 'm1', year_built: 1985 }),
      mission({ id: 'm2', year_built: 1990 }),
      mission({ id: 'm3', year_built: 1992 }),
    ]
    const g = buildKnowledgeGraph(missions, NOW)
    const p = predictFromGraph(g)
    expect(p.year_built?.value).toBe(1989)
    expect(Number.isInteger(p.year_built?.value)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// computeDelta
// ---------------------------------------------------------------------------

describe('computeDelta', () => {
  function predictionsFor(graph: UserKnowledgeGraph) {
    return predictFromGraph(graph)
  }

  it('returns changeRatio=0 when prediction matches reality exactly', () => {
    const missions = Array.from({ length: 30 }, (_, i) => mission({ id: `m-${i}` }))
    const g = buildKnowledgeGraph(missions, NOW)
    const p = predictionsFor(g)
    const actual = mission({
      id: 'new',
      postal_code: '75008',
      property_type: 'appartement',
      dpe_class: 'D',
      year_built: 1990,
      surface_m2: 65,
    })
    const d = computeDelta(p, actual)
    expect(d.changeRatio).toBe(0)
    expect(d.deltaFields).toEqual([])
  })

  it('tolerates dpe_class delta of 1 (D vs E = no delta)', () => {
    const missions = Array.from({ length: 30 }, (_, i) => mission({ id: `m-${i}`, dpe_class: 'D' }))
    const g = buildKnowledgeGraph(missions, NOW)
    const p = predictionsFor(g)
    const actual = mission({ id: 'new', dpe_class: 'E' })
    const d = computeDelta(p, actual)
    expect(d.deltaFields).not.toContain('dpe_class')
  })

  it('flags dpe_class delta > 1 (D vs F = delta)', () => {
    const missions = Array.from({ length: 30 }, (_, i) => mission({ id: `m-${i}`, dpe_class: 'D' }))
    const g = buildKnowledgeGraph(missions, NOW)
    const p = predictionsFor(g)
    const actual = mission({ id: 'new', dpe_class: 'F' })
    const d = computeDelta(p, actual)
    expect(d.deltaFields).toContain('dpe_class')
  })

  it('tolerates year_built ±5 years', () => {
    const missions = Array.from({ length: 30 }, (_, i) =>
      mission({ id: `m-${i}`, year_built: 1990 }),
    )
    const g = buildKnowledgeGraph(missions, NOW)
    const p = predictionsFor(g)
    const close = mission({ id: 'new', year_built: 1993 })
    expect(computeDelta(p, close).deltaFields).not.toContain('year_built')
    const far = mission({ id: 'new', year_built: 1980 })
    expect(computeDelta(p, far).deltaFields).toContain('year_built')
  })

  it('tolerates surface_m2 ±10%', () => {
    const missions = Array.from({ length: 30 }, (_, i) =>
      mission({ id: `m-${i}`, surface_m2: 100 }),
    )
    const g = buildKnowledgeGraph(missions, NOW)
    const p = predictionsFor(g)
    const close = mission({ id: 'new', surface_m2: 105 })
    expect(computeDelta(p, close).deltaFields).not.toContain('surface_m2')
    const far = mission({ id: 'new', surface_m2: 130 })
    expect(computeDelta(p, far).deltaFields).toContain('surface_m2')
  })

  it('returns changeRatio=1 when all fields diverge (100% delta)', () => {
    const missions = Array.from({ length: 30 }, (_, i) => mission({ id: `m-${i}` }))
    const g = buildKnowledgeGraph(missions, NOW)
    const p = predictionsFor(g)
    const actual: MissionLite = {
      id: 'new',
      created_at: NOW,
      postal_code: '13001',
      property_type: 'maison',
      year_built: 1950,
      surface_m2: 200,
      dpe_class: 'G',
    }
    const d = computeDelta(p, actual)
    expect(d.changeRatio).toBe(1)
    expect(d.deltaFields).toHaveLength(5)
  })

  it('returns ratio ~0.5 when half the fields diverge', () => {
    const missions = Array.from({ length: 30 }, (_, i) => mission({ id: `m-${i}` }))
    const g = buildKnowledgeGraph(missions, NOW)
    const p = predictionsFor(g)
    const actual = mission({
      id: 'new',
      postal_code: '13001', // diverges
      property_type: 'maison', // diverges
      dpe_class: 'D', // matches
      year_built: 1990, // matches
      surface_m2: 65, // matches
    })
    const d = computeDelta(p, actual)
    expect(d.changeRatio).toBeCloseTo(0.4, 1)
    expect(d.deltaFields).toContain('postal_code')
    expect(d.deltaFields).toContain('property_type')
  })

  it('flags no_predictions_available when graph is empty', () => {
    const g = buildKnowledgeGraph([], NOW)
    const p = predictFromGraph(g)
    const actual = mission({ id: 'new' })
    const d = computeDelta(p, actual)
    expect(d.changeRatio).toBe(1)
    expect(d.deltaFields).toContain('no_predictions_available')
  })
})

// ---------------------------------------------------------------------------
// routeAnalysisStrategy
// ---------------------------------------------------------------------------

describe('routeAnalysisStrategy', () => {
  it('returns reuse_full when changeRatio < 0.1', () => {
    const r = routeAnalysisStrategy({ changeRatio: 0.05, deltaFields: [] })
    expect(r.strategy).toBe('reuse_full')
    expect(r.estimated_cost_eur).toBeLessThan(0.005)
  })

  it('returns reuse_full when changeRatio = 0 (perfect prediction)', () => {
    const r = routeAnalysisStrategy({ changeRatio: 0, deltaFields: [] })
    expect(r.strategy).toBe('reuse_full')
  })

  it('returns incremental when 0.1 <= changeRatio < 0.3', () => {
    expect(routeAnalysisStrategy({ changeRatio: 0.1, deltaFields: ['x'] }).strategy).toBe(
      'incremental',
    )
    expect(routeAnalysisStrategy({ changeRatio: 0.2, deltaFields: ['x'] }).strategy).toBe(
      'incremental',
    )
    expect(routeAnalysisStrategy({ changeRatio: 0.29, deltaFields: ['x'] }).strategy).toBe(
      'incremental',
    )
  })

  it('returns full_analysis when changeRatio >= 0.3', () => {
    expect(routeAnalysisStrategy({ changeRatio: 0.3, deltaFields: ['x'] }).strategy).toBe(
      'full_analysis',
    )
    expect(routeAnalysisStrategy({ changeRatio: 0.5, deltaFields: ['x'] }).strategy).toBe(
      'full_analysis',
    )
    expect(routeAnalysisStrategy({ changeRatio: 1, deltaFields: ['x'] }).strategy).toBe(
      'full_analysis',
    )
  })

  it('forces full_analysis when no_predictions_available (cold start)', () => {
    const r = routeAnalysisStrategy({
      changeRatio: 0.05,
      deltaFields: ['no_predictions_available'],
    })
    expect(r.strategy).toBe('full_analysis')
  })

  it('incremental cost is between reuse and full cost', () => {
    const reuse = routeAnalysisStrategy({ changeRatio: 0, deltaFields: [] })
    const incr = routeAnalysisStrategy({ changeRatio: 0.15, deltaFields: ['x'] })
    const full = routeAnalysisStrategy({ changeRatio: 0.5, deltaFields: ['x'] })
    expect(reuse.estimated_cost_eur).toBeLessThan(incr.estimated_cost_eur)
    expect(incr.estimated_cost_eur).toBeLessThan(full.estimated_cost_eur)
  })

  it('threshold edge cases : 0.099 -> reuse, 0.1 -> incremental', () => {
    expect(routeAnalysisStrategy({ changeRatio: 0.099, deltaFields: ['x'] }).strategy).toBe(
      'reuse_full',
    )
    expect(routeAnalysisStrategy({ changeRatio: 0.1, deltaFields: ['x'] }).strategy).toBe(
      'incremental',
    )
  })

  it('threshold edge cases : 0.299 -> incremental, 0.3 -> full_analysis', () => {
    expect(routeAnalysisStrategy({ changeRatio: 0.299, deltaFields: ['x'] }).strategy).toBe(
      'incremental',
    )
    expect(routeAnalysisStrategy({ changeRatio: 0.3, deltaFields: ['x'] }).strategy).toBe(
      'full_analysis',
    )
  })
})
