/**
 * Vitest — Algo A1.3.12 SEO page quality auto-scorer.
 */

import { describe, expect, it } from 'vitest'
import { type SeoQualityInput, scoreSeoQuality } from './seo-quality-scorer'

function baseInput(overrides: Partial<SeoQualityInput> = {}): SeoQualityInput {
  return {
    page_type: 'city',
    has_real_diagnostician: true,
    has_local_data: true,
    has_human_signature: true,
    bounce_rate: 0.45,
    avg_time_on_page_sec: 120,
    word_count: 1000,
    last_content_revision_at: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    pogo_sticking_detected: false,
    is_duplicate_template: false,
    ...overrides,
  }
}

describe('scoreSeoQuality', () => {
  it('returns excellent bucket for fully optimized page', () => {
    const res = scoreSeoQuality(baseInput())
    expect(res.bucket).toBe('excellent')
    expect(res.quality_score).toBeGreaterThanOrEqual(75)
    expect(res.should_unpublish).toBe(false)
    expect(res.needs_refresh).toBe(false)
    expect(res.refresh_reasons).toContain('none')
  })

  it('returns thin bucket for page without diag/local data/signature', () => {
    const res = scoreSeoQuality(
      baseInput({
        has_real_diagnostician: false,
        has_local_data: false,
        has_human_signature: false,
        bounce_rate: 0.8,
        avg_time_on_page_sec: 10,
        word_count: 200,
        pogo_sticking_detected: true,
        is_duplicate_template: true,
      }),
    )
    expect(res.bucket).toBe('thin')
    expect(res.quality_score).toBeLessThan(35)
    expect(res.should_unpublish).toBe(true)
    expect(res.refresh_reasons).toContain('no_real_diag')
    expect(res.refresh_reasons).toContain('pogo_stick')
  })

  it('flags high_bounce when bounce_rate > 0.7', () => {
    const res = scoreSeoQuality(baseInput({ bounce_rate: 0.85 }))
    expect(res.refresh_reasons).toContain('high_bounce')
  })

  it('flags low_engagement when time on page < 30s', () => {
    const res = scoreSeoQuality(baseInput({ avg_time_on_page_sec: 15 }))
    expect(res.refresh_reasons).toContain('low_engagement')
  })

  it('flags low_word_count when content too short for page type', () => {
    const res = scoreSeoQuality(baseInput({ word_count: 200, page_type: 'city' }))
    // < 800 * 0.4 = 320 threshold low
    expect(res.refresh_reasons).toContain('low_word_count')
  })

  it('flags stale when last revision > 1 year', () => {
    const oldDate = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString()
    const res = scoreSeoQuality(baseInput({ last_content_revision_at: oldDate }))
    expect(res.refresh_reasons).toContain('stale')
  })

  it('uses 1500 word target for guide page_type', () => {
    const guideOk = scoreSeoQuality(baseInput({ page_type: 'guide', word_count: 1500 }))
    const guideLow = scoreSeoQuality(baseInput({ page_type: 'guide', word_count: 800 }))
    expect(guideOk.signals.find((s) => s.code === 'WORD_COUNT')?.points).toBeGreaterThan(
      guideLow.signals.find((s) => s.code === 'WORD_COUNT')?.points ?? 99,
    )
  })

  it('does not unpublish if only one thin signal', () => {
    const res = scoreSeoQuality(baseInput({ has_real_diagnostician: false }))
    expect(res.should_unpublish).toBe(false)
  })

  it('generates a contextual human_message per bucket', () => {
    const excellent = scoreSeoQuality(baseInput())
    expect(excellent.human_message).toMatch(/qualité éditoriale élevée|qualité/)

    const thin = scoreSeoQuality(
      baseInput({
        has_real_diagnostician: false,
        has_local_data: false,
        has_human_signature: false,
        bounce_rate: 0.9,
        avg_time_on_page_sec: 5,
        word_count: 100,
        pogo_sticking_detected: true,
        is_duplicate_template: true,
      }),
    )
    expect(thin.human_message).toMatch(/dépublication/i)
  })
})
