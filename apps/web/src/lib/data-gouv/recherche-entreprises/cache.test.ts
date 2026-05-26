/**
 * Vitest — cache 7j SIRENE.
 *
 * Couvre :
 *   - cache hit (résultat positif valide)
 *   - cache miss (rien en DB)
 *   - cache expiré (expires_at < now)
 *   - DB error → graceful miss
 *   - store ignore les résultats !found (network/not_found/rate_limit)
 *   - store upsert idempotent
 */

import { describe, expect, it, vi } from 'vitest'
import { lookupVerificationCache, storeVerificationCache } from './cache'
import type { VerificationResult } from './client'

const SIRET = '12345678900015'

const VALID_RESULT: VerificationResult = {
  siret: SIRET,
  found: true,
  isActive: true,
  isDiagnosticNAF: true,
  nafCode: '71.20B',
  nafLabel: 'Analyses, essais et inspections techniques',
  companyName: 'CABINET DIAG NORMANDIE',
  legalForm: '5710',
}

function buildSupabaseSelect(row: unknown | null, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error })
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))
  return { from, select, eq, maybeSingle }
}

function buildSupabaseUpsert(error: unknown = null) {
  const upsert = vi.fn().mockResolvedValue({ error })
  const from = vi.fn(() => ({ upsert }))
  return { from, upsert }
}

describe('lookupVerificationCache', () => {
  it('returns hit when row exists and expires_at is in the future', async () => {
    const future = new Date(Date.now() + 6 * 24 * 3600 * 1000).toISOString()
    const builder = buildSupabaseSelect({
      siret: SIRET,
      result: VALID_RESULT,
      checked_at: new Date().toISOString(),
      expires_at: future,
    })

    const result = await lookupVerificationCache(
      // biome-ignore lint/suspicious/noExplicitAny: mock partiel
      { from: builder.from } as any,
      SIRET,
    )
    expect(result.hit).toBe(true)
    expect(result.result?.siret).toBe(SIRET)
    expect(builder.from).toHaveBeenCalledWith('sirene_check_cache')
    expect(builder.eq).toHaveBeenCalledWith('siret', SIRET)
  })

  it('returns miss when no row exists', async () => {
    const builder = buildSupabaseSelect(null)
    const result = await lookupVerificationCache(
      // biome-ignore lint/suspicious/noExplicitAny: mock
      { from: builder.from } as any,
      SIRET,
    )
    expect(result.hit).toBe(false)
    expect(result.result).toBeNull()
  })

  it('returns miss when row is expired', async () => {
    const past = new Date(Date.now() - 1000).toISOString()
    const builder = buildSupabaseSelect({
      siret: SIRET,
      result: VALID_RESULT,
      checked_at: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
      expires_at: past,
    })

    const result = await lookupVerificationCache(
      // biome-ignore lint/suspicious/noExplicitAny: mock
      { from: builder.from } as any,
      SIRET,
    )
    expect(result.hit).toBe(false)
  })

  it('returns miss gracefully on DB error', async () => {
    const builder = buildSupabaseSelect(null, { message: 'permission denied' })
    const result = await lookupVerificationCache(
      // biome-ignore lint/suspicious/noExplicitAny: mock
      { from: builder.from } as any,
      SIRET,
    )
    expect(result.hit).toBe(false)
  })
})

describe('storeVerificationCache', () => {
  it('upserts a found result with expires_at + 7 days', async () => {
    const builder = buildSupabaseUpsert()
    const ok = await storeVerificationCache(
      // biome-ignore lint/suspicious/noExplicitAny: mock
      { from: builder.from } as any,
      VALID_RESULT,
    )
    expect(ok).toBe(true)
    expect(builder.upsert).toHaveBeenCalledTimes(1)
    const [payload, options] = builder.upsert.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ]
    expect(payload.siret).toBe(SIRET)
    expect(options.onConflict).toBe('siret')
    const expires = new Date(String(payload.expires_at)).getTime()
    const checked = new Date(String(payload.checked_at)).getTime()
    // Tolérance de 1h pour le diff 7j
    expect(expires - checked).toBeGreaterThan(6.9 * 24 * 3600 * 1000)
    expect(expires - checked).toBeLessThan(7.1 * 24 * 3600 * 1000)
  })

  it('skips storage when result is not found (network/not_found/rate_limit)', async () => {
    const builder = buildSupabaseUpsert()
    const ok = await storeVerificationCache(
      // biome-ignore lint/suspicious/noExplicitAny: mock
      { from: builder.from } as any,
      { ...VALID_RESULT, found: false, error: 'network' },
    )
    expect(ok).toBe(false)
    expect(builder.upsert).not.toHaveBeenCalled()
  })

  it('returns false but does not throw on DB error', async () => {
    const builder = buildSupabaseUpsert({ message: 'db down' })
    const ok = await storeVerificationCache(
      // biome-ignore lint/suspicious/noExplicitAny: mock
      { from: builder.from } as any,
      VALID_RESULT,
    )
    expect(ok).toBe(false)
  })
})
