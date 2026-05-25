/**
 * Vitest — Lot B61 : routeur d'analyse mission (pure-fn + helper DB mockable).
 *
 * Couvre :
 *   - decideStrategy (pure-fn) : no_graph / cold_start / delta < 10% (reuse_full)
 *     / delta 10-30% (incremental) / delta > 30% (full_analysis) / sans hints
 *   - loadUserGraph (DB) : succès + erreur (dégradation gracieuse)
 */

import { describe, expect, it, vi } from 'vitest'
import {
  type SupabaseLike,
  decideStrategy,
  loadUserGraph,
  routeMissionAnalysis,
} from './mission-analysis-router'
import {
  type MissionLite,
  type UserKnowledgeGraph,
  buildKnowledgeGraph,
} from './user-knowledge-graph'

const NOW = '2026-05-26T03:00:00.000Z'

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

/**
 * Construit un graph "mature" stable : 30 missions très similaires (75008,
 * appartement, 65 m², DPE D, marques Atlantic+Saunier Duval) pour qu'on ait
 * des prédictions à confidence élevée.
 */
function matureGraph(): UserKnowledgeGraph {
  const missions: MissionLite[] = []
  for (let i = 0; i < 30; i++) {
    missions.push(
      mission({
        id: `m-${i}`,
        created_at: `2026-04-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
      }),
    )
  }
  return buildKnowledgeGraph(missions, NOW)
}

// ---------------------------------------------------------------------------
// decideStrategy
// ---------------------------------------------------------------------------

describe('decideStrategy', () => {
  it('returns full_analysis with reason=no_graph when graph is null (cold start absolu)', () => {
    const d = decideStrategy(null, {}, null)
    expect(d.strategy).toBe('full_analysis')
    expect(d.cold_start).toBe(true)
    expect(d.predictions).toBeNull()
    expect(d.delta).toBeNull()
    expect(d.reason).toBe('no_graph')
    expect(d.estimated_cost_eur).toBeGreaterThan(0)
  })

  it('returns full_analysis with reason=cold_start when graph has < 10 missions', () => {
    const smallGraph = buildKnowledgeGraph([mission({ id: 'm-1' }), mission({ id: 'm-2' })], NOW)
    const d = decideStrategy(smallGraph, {}, mission())
    expect(d.strategy).toBe('full_analysis')
    expect(d.cold_start).toBe(true)
    expect(d.predictions).not.toBeNull()
    expect(d.reason).toBe('cold_start')
  })

  it('returns full_analysis when mature graph but no actualHints to compare', () => {
    const g = matureGraph()
    const d = decideStrategy(g, { postal_code: '75008' }, null)
    expect(d.strategy).toBe('full_analysis')
    expect(d.cold_start).toBe(false)
    expect(d.predictions).not.toBeNull()
    expect(d.delta).toBeNull()
    expect(d.reason).toBe('cold_start')
  })

  it('returns reuse_full when mature graph + actual matches predictions (delta < 10%)', () => {
    const g = matureGraph()
    // Mission "presque identique" au pattern moyen du diag → delta ~0
    const actual = mission({
      id: 'new-mission',
      postal_code: '75008',
      property_type: 'appartement',
      year_built: 1990,
      surface_m2: 65,
      dpe_class: 'D',
    })
    const d = decideStrategy(g, {}, actual)
    expect(d.strategy).toBe('reuse_full')
    expect(d.cold_start).toBe(false)
    expect(d.delta).not.toBeNull()
    expect(d.delta?.changeRatio).toBeLessThan(0.1)
    expect(d.reason).toBe('delta_computed')
  })

  it('returns incremental when mature graph + actual partiellement diverge (10% ≤ delta < 30%)', () => {
    const g = matureGraph()
    // 1 champ diverge sur ~5 comparés (postal_code différent mais reste OK)
    // → ratio = 0.2, dans la fenêtre 10-30%
    const actual = mission({
      id: 'new-mission',
      postal_code: '75001', // ≠ 75008 prédit → 1 delta
      property_type: 'appartement', // OK
      year_built: 1990, // OK (tolérance ±5)
      surface_m2: 65, // OK (tolérance ±10%)
      dpe_class: 'D', // OK
    })
    const d = decideStrategy(g, {}, actual)
    expect(d.strategy).toBe('incremental')
    expect(d.delta?.changeRatio).toBeGreaterThanOrEqual(0.1)
    expect(d.delta?.changeRatio).toBeLessThan(0.3)
  })

  it('returns full_analysis when mature graph + actual fortement divergent (delta ≥ 30%)', () => {
    const g = matureGraph()
    // Beaucoup de champs divergent → mission "atypique" pour ce diag
    const actual = mission({
      id: 'new-mission',
      postal_code: '13001', // diverge
      property_type: 'maison', // diverge
      year_built: 1850, // diverge (>5 ans d'écart)
      surface_m2: 250, // diverge (>10%)
      dpe_class: 'A', // diverge (>1 cran de D)
    })
    const d = decideStrategy(g, {}, actual)
    expect(d.strategy).toBe('full_analysis')
    expect(d.delta?.changeRatio).toBeGreaterThanOrEqual(0.3)
    expect(d.reason).toBe('delta_computed')
  })

  it('respects missionInput postal_code hint (zone-aware) and still routes correctly', () => {
    const g = matureGraph()
    const actual = mission({
      id: 'm-hint',
      postal_code: '75008',
      property_type: 'appartement',
      year_built: 1990,
      surface_m2: 65,
      dpe_class: 'D',
    })
    // missionInput préfille le postal_code → confidence du postal monte à 1
    const d = decideStrategy(g, { postal_code: '75008' }, actual)
    expect(d.strategy).toBe('reuse_full')
    expect(d.predictions?.postal_code?.confidence).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// loadUserGraph
// ---------------------------------------------------------------------------

describe('loadUserGraph', () => {
  it('returns graph row when DB has it', async () => {
    const g = matureGraph()
    const row = { graph: g, sample_size: g.sample_size }
    const mock: SupabaseLike = {
      schema: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: row, error: null }),
            }),
          }),
        }),
      }),
    }
    const out = await loadUserGraph(mock, 'diag-abc')
    expect(out).not.toBeNull()
    expect(out?.sample_size).toBe(30)
  })

  it('returns null when DB has no row', async () => {
    const mock: SupabaseLike = {
      schema: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }
    const out = await loadUserGraph(mock, 'diag-missing')
    expect(out).toBeNull()
  })

  it('degrades gracefully to null when DB returns an error (no throw)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // silence expected warn during this test
    })
    const mock: SupabaseLike = {
      schema: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: null, error: { message: 'connection lost' } }),
            }),
          }),
        }),
      }),
    }
    const out = await loadUserGraph(mock, 'diag-err')
    expect(out).toBeNull()
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// routeMissionAnalysis (composite)
// ---------------------------------------------------------------------------

describe('routeMissionAnalysis', () => {
  it('composes loadUserGraph + decideStrategy end-to-end (no graph → full_analysis)', async () => {
    const mock: SupabaseLike = {
      schema: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }
    const d = await routeMissionAnalysis(mock, 'diag-x', {}, mission())
    expect(d.strategy).toBe('full_analysis')
    expect(d.reason).toBe('no_graph')
  })

  it('composes end-to-end (graph mature + match → reuse_full)', async () => {
    const g = matureGraph()
    const mock: SupabaseLike = {
      schema: () => ({
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: { graph: g, sample_size: 30 }, error: null }),
            }),
          }),
        }),
      }),
    }
    const d = await routeMissionAnalysis(mock, 'diag-y', {}, mission({ id: 'new' }))
    expect(d.strategy).toBe('reuse_full')
    expect(d.reason).toBe('delta_computed')
  })
})
