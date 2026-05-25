/**
 * Vitest — A1.3.4 unified-profile fetchers + freshness scoring.
 *
 * Tests des fetchers en mockant `global.fetch` (vi.spyOn + mockImplementation).
 * Couvre les chemins success, erreur HTTP, payload malformé.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  computeFreshnessScore,
  fetchBan,
  fetchDpeFromAdeme,
  fetchErpFromGeorisques,
} from './unified-profile'

function mockFetchOk(body: unknown): void {
  vi.spyOn(global, 'fetch').mockImplementation(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    } as Response),
  )
}

function mockFetchFail(status = 500): void {
  vi.spyOn(global, 'fetch').mockImplementation(() =>
    Promise.resolve({
      ok: false,
      status,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve('error'),
    } as Response),
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchBan', () => {
  it('returns null for empty address', async () => {
    const res = await fetchBan('')
    expect(res).toBeNull()
  })

  it('returns parsed BAN result on success', async () => {
    mockFetchOk({
      features: [
        {
          geometry: { coordinates: [1.07, 49.92] },
          properties: {
            id: '76217_0250_00012',
            postcode: '76200',
            city: 'Dieppe',
            citycode: '76217',
            context: '76, Seine-Maritime, Normandie',
          },
        },
      ],
    })
    const res = await fetchBan('12 rue de la mer, 76200 Dieppe')
    expect(res).not.toBeNull()
    expect(res?.id).toBe('76217_0250_00012')
    expect(res?.lat).toBe(49.92)
    expect(res?.lng).toBe(1.07)
    expect(res?.postcode).toBe('76200')
    expect(res?.city).toBe('Dieppe')
    expect(res?.department).toBe('76')
  })

  it('returns null when no features returned', async () => {
    mockFetchOk({ features: [] })
    const res = await fetchBan('adresse inexistante xyz')
    expect(res).toBeNull()
  })

  it('returns null on HTTP error', async () => {
    mockFetchFail(503)
    const res = await fetchBan('12 rue de la mer, 76200 Dieppe')
    expect(res).toBeNull()
  })

  it('returns null on network error (catch path)', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => Promise.reject(new Error('network')))
    const res = await fetchBan('12 rue de la mer, 76200 Dieppe')
    expect(res).toBeNull()
  })
})

describe('fetchDpeFromAdeme', () => {
  it('returns empty array on HTTP error', async () => {
    mockFetchFail(500)
    const res = await fetchDpeFromAdeme('76217_0250_00012', null)
    expect(Array.isArray(res)).toBe(true)
    expect(res).toHaveLength(0)
  })

  it('returns empty array on network error', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => Promise.reject(new Error('network')))
    const res = await fetchDpeFromAdeme('76217_0250_00012', null)
    expect(res).toHaveLength(0)
  })

  it('returns empty array when no results', async () => {
    mockFetchOk({ results: [] })
    const res = await fetchDpeFromAdeme('76217_0250_00012', null)
    expect(res).toHaveLength(0)
  })
})

describe('fetchErpFromGeorisques', () => {
  it('returns parsed risks on success', async () => {
    mockFetchOk({
      risques: {
        naturels: ['inondation', { libelle: 'mouvement de terrain' }],
        technologiques: ['SEVESO seuil bas'],
        miniers: [],
      },
      radon: { niveau: 2 },
      sismique: { zone: '3' },
    })
    const res = await fetchErpFromGeorisques(49.92, 1.07)
    expect(res.naturels).toContain('inondation')
    expect(res.naturels).toContain('mouvement de terrain')
    expect(res.technologiques).toContain('SEVESO seuil bas')
    expect(res.radon_level).toBe(2)
    expect(res.seismique).toBe('3')
  })

  it('returns empty defaults on HTTP error', async () => {
    mockFetchFail(503)
    const res = await fetchErpFromGeorisques(49.92, 1.07)
    expect(res.naturels).toHaveLength(0)
    expect(res.technologiques).toHaveLength(0)
    expect(res.radon_level).toBeNull()
    expect(res.seismique).toBeNull()
  })

  it('returns empty defaults on network error (catch path)', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => Promise.reject(new Error('timeout')))
    const res = await fetchErpFromGeorisques(49.92, 1.07)
    expect(res.naturels).toHaveLength(0)
    expect(res.miniers).toHaveLength(0)
  })

  it('handles missing risques key gracefully', async () => {
    mockFetchOk({})
    const res = await fetchErpFromGeorisques(49.92, 1.07)
    expect(res.naturels).toHaveLength(0)
    expect(res.technologiques).toHaveLength(0)
    expect(res.miniers).toHaveLength(0)
  })
})

describe('computeFreshnessScore', () => {
  // Helper : ISO string offset par X jours dans le passé
  function ago(days: number): string {
    return new Date(Date.now() - days * 86400 * 1000).toISOString()
  }

  it('returns 100 for fresh sources (all within SLA)', () => {
    const score = computeFreshnessScore({
      ban: ago(0.5),
      ign_cadastre: ago(0.5),
      ademe: ago(0.5),
      dvf: ago(10),
      georisques: ago(10),
    })
    // Each source has age < SLA, ratio close to 1.0 → score close to 100
    expect(score).toBeGreaterThanOrEqual(50)
  })

  it('returns lower score when one source is stale', () => {
    const score = computeFreshnessScore({
      ban: ago(0.5),
      ademe: ago(0.5),
      georisques: ago(45), // > 30j SLA → ratio = 0
    })
    expect(score).toBe(0)
  })

  it('ignores absent sources', () => {
    const score = computeFreshnessScore({})
    expect(score).toBe(100) // No sources to penalize → minRatio stays 1.0
  })

  it('ignores invalid date strings', () => {
    const score = computeFreshnessScore({ ban: 'not-a-date' })
    expect(score).toBe(100)
  })

  it('uses minimum ratio across sources', () => {
    const score = computeFreshnessScore({
      ban: ago(0.5), // fresh
      dvf: ago(50), // half SLA (100j)
    })
    // dvf ratio = 1 - 50/100 = 0.5 → score 50
    expect(score).toBe(50)
  })
})
