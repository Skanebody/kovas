/**
 * Vitest — equipment models cache pure-fn logic (Lot B48).
 *
 * Pure-fn déterministes (zéro IO, zéro Math.random) — testables intégralement.
 */

import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EQUIPMENT_CACHE_THRESHOLD,
  type EquipmentEntry,
  VISION_CALL_COST_EUR,
  estimateEquipmentCacheSavings,
  matchEquipmentCache,
  normalizeEquipmentKey,
  scoreEquipmentMatch,
  stringSimilarity,
} from './equipment-models'

const SAUNIER_F30: EquipmentEntry = {
  brand: 'Saunier Duval',
  model: 'F30 Pro',
  equipment_type: 'chaudiere_gaz',
  energy_type: 'gaz_naturel',
  energy_class: 'A',
  power_kw: 30,
  year_min: 2018,
  year_max: null,
  specs: { rendement_pct: 94 },
}
const ATLANTIC_SUN_MAGIC: EquipmentEntry = {
  brand: 'Atlantic',
  model: 'Sun Magic 200L',
  equipment_type: 'chauffe_eau_thermo',
  energy_type: 'electricite',
  energy_class: 'A+',
  power_kw: 2,
  year_min: 2020,
  year_max: null,
  specs: null,
}
const DE_DIETRICH_PAC: EquipmentEntry = {
  brand: 'De Dietrich',
  model: 'Strateo 8',
  equipment_type: 'pac_air_eau',
  energy_type: 'electricite',
  energy_class: 'A++',
  power_kw: 8,
  year_min: 2019,
  year_max: null,
  specs: { cop: 4.2 },
}

describe('normalizeEquipmentKey', () => {
  it('returns empty string for empty input', () => {
    expect(normalizeEquipmentKey('')).toBe('')
  })

  it('lowercases', () => {
    expect(normalizeEquipmentKey('SAUNIER DUVAL')).toBe('saunier duval')
  })

  it('removes punctuation and condenses spaces', () => {
    expect(normalizeEquipmentKey('Saunier-Duval / F30  Pro')).toBe('saunier duval f30 pro')
  })

  it('strips accents (NFD normalization)', () => {
    expect(normalizeEquipmentKey('De Dietrich Strátéo')).toBe('de dietrich strateo')
  })

  it('trims leading/trailing whitespace', () => {
    expect(normalizeEquipmentKey('   Atlantic   ')).toBe('atlantic')
  })
})

describe('stringSimilarity', () => {
  it('returns 1 for exact match (after normalization)', () => {
    expect(stringSimilarity('Saunier Duval', 'SAUNIER DUVAL')).toBe(1)
  })

  it('returns 0.95 for substring (one contains the other)', () => {
    expect(stringSimilarity('Saunier', 'Saunier Duval')).toBe(0.95)
  })

  it('returns Jaccard similarity for partial overlap', () => {
    // tokens: {saunier, duval} ∩ {saunier, francois} = {saunier}, union = 3
    expect(stringSimilarity('Saunier Duval', 'Saunier Francois')).toBeCloseTo(1 / 3, 2)
  })

  it('returns 0 for empty input', () => {
    expect(stringSimilarity('', 'Saunier')).toBe(0)
    expect(stringSimilarity('Saunier', '')).toBe(0)
  })

  it('returns 0 for completely different strings', () => {
    expect(stringSimilarity('Atlantic', 'Saunier')).toBe(0)
  })
})

describe('scoreEquipmentMatch', () => {
  it('returns 1.0 for exact match brand + model', () => {
    expect(scoreEquipmentMatch({ brand: 'Saunier Duval', model: 'F30 Pro' }, SAUNIER_F30)).toBe(1)
  })

  it('returns 0 when brand similarity < 0.5 (anti-collision)', () => {
    // "Atlantic" vs "Saunier Duval" → brand sim 0 → score 0 même si modèle match
    expect(scoreEquipmentMatch({ brand: 'Atlantic', model: 'F30 Pro' }, SAUNIER_F30)).toBe(0)
  })

  it('weights brand 40% + model 60%', () => {
    // Brand exact (1.0), model substring (0.95) → 1*0.4 + 0.95*0.6 = 0.4 + 0.57 = 0.97
    const score = scoreEquipmentMatch({ brand: 'Saunier Duval', model: 'F30' }, SAUNIER_F30)
    expect(score).toBeCloseTo(0.97, 2)
  })

  it('handles typo tolerance via substring fallback', () => {
    // "F30" est substring de "F30 Pro" → modelSim 0.95
    const score = scoreEquipmentMatch({ brand: 'Saunier', model: 'F30' }, SAUNIER_F30)
    // brand "Saunier" substring de "Saunier Duval" → 0.95
    // → 0.95*0.4 + 0.95*0.6 = 0.95
    expect(score).toBeCloseTo(0.95, 2)
  })
})

describe('matchEquipmentCache', () => {
  const POOL = [SAUNIER_F30, ATLANTIC_SUN_MAGIC, DE_DIETRICH_PAC]

  it('returns cache hit for exact brand+model match', () => {
    const r = matchEquipmentCache({ brand: 'Saunier Duval', model: 'F30 Pro' }, POOL)
    expect(r.cache_hit).toBe(true)
    expect(r.entry).toBe(SAUNIER_F30)
    expect(r.confidence).toBe(1)
  })

  it('returns cache hit with typo via substring (model F30)', () => {
    const r = matchEquipmentCache({ brand: 'Saunier Duval', model: 'F30' }, POOL)
    expect(r.cache_hit).toBe(true)
    expect(r.entry).toBe(SAUNIER_F30)
    expect(r.confidence).toBeGreaterThanOrEqual(0.85)
  })

  it('returns cache miss when no candidate close enough', () => {
    const r = matchEquipmentCache({ brand: 'Vaillant', model: 'EcoTec' }, POOL)
    expect(r.cache_hit).toBe(false)
    expect(r.entry).toBeNull()
    expect(r.reason).toMatch(/fallback Vision/i)
  })

  it('filters by equipment_type when provided', () => {
    // Filter PAC only — Saunier F30 (chaudiere_gaz) doit être exclu même s'il match nom
    const r = matchEquipmentCache(
      { brand: 'Saunier', model: 'F30', equipment_type: 'pac_air_eau' },
      POOL,
    )
    expect(r.cache_hit).toBe(false)
    expect(r.entry).toBeNull()
  })

  it('returns miss when pool is empty', () => {
    const r = matchEquipmentCache({ brand: 'Saunier', model: 'F30' }, [])
    expect(r.cache_hit).toBe(false)
    expect(r.reason).toMatch(/pool.*vide/i)
  })

  it('returns miss when equipment_type filter empties the pool', () => {
    const r = matchEquipmentCache(
      { brand: 'Saunier', model: 'F30', equipment_type: 'inconnu' },
      POOL,
    )
    expect(r.cache_hit).toBe(false)
    expect(r.reason).toMatch(/equipment_type='inconnu'/)
  })

  it('respects custom threshold parameter (stricter)', () => {
    // Avec threshold 0.99, le match substring (0.95) ne suffit plus
    const r = matchEquipmentCache({ brand: 'Saunier', model: 'F30' }, POOL, 0.99)
    expect(r.cache_hit).toBe(false)
  })

  it('picks best score among multiple candidates', () => {
    // Pool avec 2 candidats proches — doit choisir le meilleur
    const variantSaunier: EquipmentEntry = {
      ...SAUNIER_F30,
      model: 'F25 Pro',
    }
    const pool = [variantSaunier, SAUNIER_F30, DE_DIETRICH_PAC]
    const r = matchEquipmentCache({ brand: 'Saunier Duval', model: 'F30 Pro' }, pool)
    expect(r.cache_hit).toBe(true)
    expect(r.entry?.model).toBe('F30 Pro')
  })
})

describe('estimateEquipmentCacheSavings', () => {
  it('zero savings at 0% hit rate', () => {
    const s = estimateEquipmentCacheSavings({
      totalAnalyses: 1000,
      cacheHitRate: 0,
    })
    expect(s.saved_eur).toBe(0)
    expect(s.cache_cost_eur).toBe(s.baseline_cost_eur)
  })

  it('100% savings at 100% hit rate', () => {
    const s = estimateEquipmentCacheSavings({
      totalAnalyses: 1000,
      cacheHitRate: 1.0,
    })
    expect(s.cache_cost_eur).toBe(0)
    expect(s.saved_pct).toBe(100)
  })

  it('matches AI_ECONOMICS doc projection (~90% savings at 90% hit rate)', () => {
    const s = estimateEquipmentCacheSavings({
      totalAnalyses: 1000,
      cacheHitRate: 0.9,
    })
    expect(s.saved_pct).toBeCloseTo(90, 1)
    // baseline = 1000 × 0.015 = 15€, cache = 100 × 0.015 = 1,5€, saved = 13,5€
    expect(s.baseline_cost_eur).toBeCloseTo(15, 2)
    expect(s.cache_cost_eur).toBeCloseTo(1.5, 2)
    expect(s.saved_eur).toBeCloseTo(13.5, 2)
  })

  it('clamps hit rate to [0, 1]', () => {
    const s1 = estimateEquipmentCacheSavings({ totalAnalyses: 1000, cacheHitRate: 2.0 })
    const s2 = estimateEquipmentCacheSavings({ totalAnalyses: 1000, cacheHitRate: 1.0 })
    expect(s1.saved_eur).toBe(s2.saved_eur)
    const s3 = estimateEquipmentCacheSavings({ totalAnalyses: 1000, cacheHitRate: -0.5 })
    const s4 = estimateEquipmentCacheSavings({ totalAnalyses: 1000, cacheHitRate: 0 })
    expect(s3.saved_eur).toBe(s4.saved_eur)
  })

  it('handles zero totalAnalyses gracefully', () => {
    const s = estimateEquipmentCacheSavings({ totalAnalyses: 0, cacheHitRate: 0.9 })
    expect(s.baseline_cost_eur).toBe(0)
    expect(s.saved_pct).toBe(0)
  })

  it('VISION_CALL_COST_EUR is documented value', () => {
    expect(VISION_CALL_COST_EUR).toBe(0.015)
  })
})

describe('Constants', () => {
  it('DEFAULT_EQUIPMENT_CACHE_THRESHOLD is 0.85', () => {
    expect(DEFAULT_EQUIPMENT_CACHE_THRESHOLD).toBe(0.85)
  })
})
