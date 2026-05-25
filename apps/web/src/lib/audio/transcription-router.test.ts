/**
 * Vitest — `transcription-router` (Lot B58, refonte acqui-target 2026-05).
 *
 * Couverture :
 *   - decideTranscriptionEngine : seuils court/long/bruit, fallback local indispo,
 *     edge cases (audio invalide, exactement à la frontière, bruit max).
 *   - estimateTranscriptionCostEur : local gratuit, mini vs standard, taux EUR
 *     custom, audio invalide.
 *   - estimateTranscriptionSavings : projections 0%/50%/100% local, mix mini,
 *     clamps (ratios > 1, négatifs, somme > 1, totalMinutes négatif).
 */

import { describe, expect, it } from 'vitest'
import {
  type AudioMetadata,
  __testing,
  decideTranscriptionEngine,
  estimateTranscriptionCostEur,
  estimateTranscriptionSavings,
} from './transcription-router'

const {
  LONG_AUDIO_THRESHOLD_SECONDS,
  SHORT_AUDIO_THRESHOLD_SECONDS,
  NOISE_THRESHOLD_FOR_LOCAL,
  DEFAULT_USD_TO_EUR_RATE,
} = __testing

function meta(overrides: Partial<AudioMetadata> = {}): AudioMetadata {
  return {
    length_seconds: 60,
    noise_level: 0.2,
    ...overrides,
  }
}

/* ============================================================
   decideTranscriptionEngine
   ============================================================ */

describe('decideTranscriptionEngine — routage par seuils', () => {
  it('court + silencieux → local_wasm', () => {
    const d = decideTranscriptionEngine(meta({ length_seconds: 90, noise_level: 0.1 }))
    expect(d.engine).toBe('local_wasm')
    expect(d.reason).toBe('short_quiet_audio_local_eligible')
  })

  it('court + bruyant (>= seuil bruit) → api_whisper_mini', () => {
    const d = decideTranscriptionEngine(
      meta({ length_seconds: 90, noise_level: NOISE_THRESHOLD_FOR_LOCAL + 0.05 }),
    )
    expect(d.engine).toBe('api_whisper_mini')
    expect(d.reason).toBe('default_mini_economical')
  })

  it('moyen (>= 180s, <= 600s) → api_whisper_mini', () => {
    const d = decideTranscriptionEngine(meta({ length_seconds: 300, noise_level: 0.1 }))
    expect(d.engine).toBe('api_whisper_mini')
    expect(d.reason).toBe('default_mini_economical')
  })

  it('long (> 600s) → api_whisper_standard', () => {
    const d = decideTranscriptionEngine(meta({ length_seconds: 800, noise_level: 0.1 }))
    expect(d.engine).toBe('api_whisper_standard')
    expect(d.reason).toBe('long_audio_above_600s')
  })

  it('très long (1h+) → api_whisper_standard', () => {
    const d = decideTranscriptionEngine(meta({ length_seconds: 3600, noise_level: 0.5 }))
    expect(d.engine).toBe('api_whisper_standard')
  })

  it('localAvailable=false + court → fallback api_whisper_mini', () => {
    const d = decideTranscriptionEngine(meta({ length_seconds: 60, noise_level: 0.1 }), {
      localAvailable: false,
    })
    expect(d.engine).toBe('api_whisper_mini')
    expect(d.reason).toBe('local_unavailable_fallback_mini')
  })

  it('localAvailable=false + long → api_whisper_standard (qualité prime)', () => {
    const d = decideTranscriptionEngine(meta({ length_seconds: 900, noise_level: 0.1 }), {
      localAvailable: false,
    })
    expect(d.engine).toBe('api_whisper_standard')
    expect(d.reason).toBe('long_audio_no_local')
  })

  it('audio invalide (length 0) → fallback api_whisper_mini explicite', () => {
    const d = decideTranscriptionEngine(meta({ length_seconds: 0, noise_level: 0.1 }))
    expect(d.engine).toBe('api_whisper_mini')
    expect(d.reason).toBe('invalid_length_fallback_mini')
  })

  it('audio invalide (length négative) → fallback api_whisper_mini', () => {
    const d = decideTranscriptionEngine(meta({ length_seconds: -5, noise_level: 0.1 }))
    expect(d.engine).toBe('api_whisper_mini')
  })

  it('audio invalide (NaN length) → fallback api_whisper_mini', () => {
    const d = decideTranscriptionEngine(meta({ length_seconds: Number.NaN, noise_level: 0.1 }))
    expect(d.engine).toBe('api_whisper_mini')
  })

  it('frontière exacte SHORT_AUDIO (180s) — pas strictement < → mini', () => {
    const d = decideTranscriptionEngine(
      meta({ length_seconds: SHORT_AUDIO_THRESHOLD_SECONDS, noise_level: 0.1 }),
    )
    // 180 n'est PAS strictement < 180, donc bascule sur mini par défaut.
    expect(d.engine).toBe('api_whisper_mini')
  })

  it('frontière exacte LONG_AUDIO (600s) — pas strictement > → mini', () => {
    const d = decideTranscriptionEngine(
      meta({ length_seconds: LONG_AUDIO_THRESHOLD_SECONDS, noise_level: 0.1 }),
    )
    // 600 n'est PAS strictement > 600, donc reste mini.
    expect(d.engine).toBe('api_whisper_mini')
  })

  it('frontière bruit exacte (noise = 0.4) → mini (pas strictement <)', () => {
    const d = decideTranscriptionEngine(
      meta({ length_seconds: 60, noise_level: NOISE_THRESHOLD_FOR_LOCAL }),
    )
    expect(d.engine).toBe('api_whisper_mini')
  })
})

/* ============================================================
   estimateTranscriptionCostEur
   ============================================================ */

describe('estimateTranscriptionCostEur — pricing pure-fn', () => {
  it('local_wasm → 0 EUR quelle que soit la durée', () => {
    expect(estimateTranscriptionCostEur(meta({ length_seconds: 60 }), 'local_wasm')).toBe(0)
    expect(estimateTranscriptionCostEur(meta({ length_seconds: 3600 }), 'local_wasm')).toBe(0)
  })

  it('api_whisper_mini → $0.003/min × 0.92 EUR', () => {
    // 60s = 1 min × $0.003 × 0.92 = 0.00276 EUR
    const cost = estimateTranscriptionCostEur(meta({ length_seconds: 60 }), 'api_whisper_mini')
    expect(cost).toBeCloseTo(0.00276, 5)
  })

  it('api_whisper_standard → $0.006/min × 0.92 EUR (2× mini)', () => {
    const cost = estimateTranscriptionCostEur(meta({ length_seconds: 60 }), 'api_whisper_standard')
    expect(cost).toBeCloseTo(0.00552, 5)
  })

  it('respecte le taux USD→EUR custom', () => {
    const cost = estimateTranscriptionCostEur(
      meta({ length_seconds: 600 }),
      'api_whisper_mini',
      1.0, // parité USD = EUR
    )
    // 10 min × $0.003 = $0.03 → 0.03 EUR
    expect(cost).toBeCloseTo(0.03, 5)
  })

  it('audio invalide (length 0) → 0 EUR', () => {
    expect(estimateTranscriptionCostEur(meta({ length_seconds: 0 }), 'api_whisper_mini')).toBe(0)
    expect(
      estimateTranscriptionCostEur(meta({ length_seconds: -10 }), 'api_whisper_standard'),
    ).toBe(0)
  })

  it('utilise DEFAULT_USD_TO_EUR_RATE quand non fourni', () => {
    const cost = estimateTranscriptionCostEur(meta({ length_seconds: 120 }), 'api_whisper_mini')
    // 2 min × $0.003 × 0.92 = 0.00552
    expect(cost).toBeCloseTo(2 * 0.003 * DEFAULT_USD_TO_EUR_RATE, 5)
  })
})

/* ============================================================
   estimateTranscriptionSavings
   ============================================================ */

describe('estimateTranscriptionSavings — projection mix', () => {
  it('0% local, 0% mini (100% standard) → savings = 0', () => {
    const p = estimateTranscriptionSavings({
      totalMinutes: 1000,
      localShareRatio: 0,
      miniShareRatio: 0,
    })
    expect(p.savingsEur).toBe(0)
    expect(p.savingsPercent).toBe(0)
    expect(p.effectiveCostEur).toBe(p.baselineCostEur)
  })

  it('100% local → savings = 100%', () => {
    const p = estimateTranscriptionSavings({
      totalMinutes: 1000,
      localShareRatio: 1,
      miniShareRatio: 0,
    })
    expect(p.effectiveCostEur).toBe(0)
    expect(p.savingsPercent).toBe(100)
    expect(p.savingsEur).toBeCloseTo(p.baselineCostEur, 5)
  })

  it('50% local + 50% standard → savings ≈ 50%', () => {
    const p = estimateTranscriptionSavings({
      totalMinutes: 1000,
      localShareRatio: 0.5,
      miniShareRatio: 0,
    })
    expect(p.savingsPercent).toBeCloseTo(50, 1)
  })

  it('100% mini → savings = 50% (mini = standard / 2)', () => {
    const p = estimateTranscriptionSavings({
      totalMinutes: 1000,
      localShareRatio: 0,
      miniShareRatio: 1,
    })
    expect(p.savingsPercent).toBeCloseTo(50, 1)
  })

  it('mix 50% local + 50% mini → savings = 75% (50%*100 + 50%*50)', () => {
    const p = estimateTranscriptionSavings({
      totalMinutes: 1000,
      localShareRatio: 0.5,
      miniShareRatio: 0.5,
    })
    expect(p.savingsPercent).toBeCloseTo(75, 1)
  })

  it('clamp : ratios > 1 sont ramenés à 1', () => {
    const p = estimateTranscriptionSavings({
      totalMinutes: 1000,
      localShareRatio: 2,
      miniShareRatio: 0,
    })
    expect(p.savingsPercent).toBe(100)
  })

  it('clamp : ratios négatifs ramenés à 0', () => {
    const p = estimateTranscriptionSavings({
      totalMinutes: 1000,
      localShareRatio: -0.5,
      miniShareRatio: -0.3,
    })
    expect(p.savingsEur).toBe(0)
    expect(p.savingsPercent).toBe(0)
  })

  it('clamp : local + mini > 1 → mini réduit, standard = 0', () => {
    // local=0.8 + mini=0.5 → mini clampé à 0.2, standard = 0
    const p = estimateTranscriptionSavings({
      totalMinutes: 1000,
      localShareRatio: 0.8,
      miniShareRatio: 0.5,
    })
    // Effective = 1000 * (0.8 * 0 + 0.2 * 0.003) = 0.6 USD → 0.552 EUR
    // Baseline = 1000 * 0.006 = 6 USD → 5.52 EUR
    // Savings = (5.52 - 0.552) / 5.52 = 90%
    expect(p.savingsPercent).toBeCloseTo(90, 1)
  })

  it('totalMinutes négatif → tous coûts à 0', () => {
    const p = estimateTranscriptionSavings({
      totalMinutes: -100,
      localShareRatio: 0.5,
      miniShareRatio: 0.5,
    })
    expect(p.baselineCostEur).toBe(0)
    expect(p.effectiveCostEur).toBe(0)
    expect(p.savingsEur).toBe(0)
    expect(p.savingsPercent).toBe(0)
  })

  it('totalMinutes = 0 → savings 0%, coûts 0 (no division by zero)', () => {
    const p = estimateTranscriptionSavings({
      totalMinutes: 0,
      localShareRatio: 0.5,
      miniShareRatio: 0.5,
    })
    expect(p.savingsPercent).toBe(0)
    expect(p.baselineCostEur).toBe(0)
  })
})
