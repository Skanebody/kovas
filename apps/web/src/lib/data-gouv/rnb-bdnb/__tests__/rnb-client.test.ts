/**
 * Tests unitaires RNB client.
 *
 * Stratégie : pas de MSW (sur-dépendance). On injecte `fetchImpl` directement,
 * ce qui mock l'API au plus près du contrat publié.
 */

import { describe, expect, it, vi } from 'vitest'
import { NO_OP_CACHE, lookupById, lookupByPoint } from '../rnb-client'
import { RnbApiError, type RnbBuilding, type RnbBuildingList } from '../types'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const FAKE_BUILDING: RnbBuilding = {
  rnb_id: 'ABCD1234EFGH',
  status: 'constructed',
  point: { type: 'Point', coordinates: [2.3522, 48.8566] },
  addresses: [
    {
      street_number: '12',
      street_name: 'Rivoli',
      street_type: 'rue',
      city_zipcode: '75001',
      city_name: 'Paris',
      city_insee_code: '75101',
    },
  ],
}

describe('lookupByPoint', () => {
  it("renvoie le premier bâtiment d'une réponse paginée", async () => {
    const list: RnbBuildingList = { count: 1, results: [FAKE_BUILDING] }
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(list))

    const result = await lookupByPoint(48.8566, 2.3522, { fetchImpl, cache: NO_OP_CACHE })

    expect(result?.rnb_id).toBe('ABCD1234EFGH')
    expect(fetchImpl).toHaveBeenCalledOnce()
    const calledUrl = fetchImpl.mock.calls[0]?.[0]
    expect(String(calledUrl)).toContain('point=2.3522000%2C48.8566000')
  })

  it('renvoie null si aucun résultat (zone rurale isolée)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ count: 0, results: [] }))
    const result = await lookupByPoint(48.8, 2.3, { fetchImpl, cache: NO_OP_CACHE })
    expect(result).toBeNull()
  })

  it("renvoie null si l'API répond 404", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ detail: 'Not found' }, 404))
    const result = await lookupByPoint(48.8, 2.3, { fetchImpl, cache: NO_OP_CACHE })
    expect(result).toBeNull()
  })

  it('retry sur 5xx puis succès', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse({ count: 1, results: [FAKE_BUILDING] }))

    const result = await lookupByPoint(48.8566, 2.3522, {
      fetchImpl,
      cache: NO_OP_CACHE,
      maxAttempts: 2,
    })

    expect(result?.rnb_id).toBe('ABCD1234EFGH')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('jette RnbApiError("rate_limit") sur 429', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ detail: 'Throttled' }, 429))

    await expect(
      lookupByPoint(48.8, 2.3, { fetchImpl, cache: NO_OP_CACHE }),
    ).rejects.toBeInstanceOf(RnbApiError)
  })

  it('jette RnbApiError("timeout") quand fetch est abort', async () => {
    const fetchImpl: typeof fetch = (_url, init) =>
      new Promise((_, reject) => {
        const signal = init?.signal as AbortSignal | undefined
        signal?.addEventListener('abort', () => {
          const err = new Error('Aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })

    await expect(
      lookupByPoint(48.8, 2.3, {
        fetchImpl,
        cache: NO_OP_CACHE,
        timeoutMs: 10,
        maxAttempts: 1,
      }),
    ).rejects.toMatchObject({ code: 'timeout' })
  })

  it('lit depuis le cache si fresh (skip fetch)', async () => {
    const fetchImpl = vi.fn()
    const cache = {
      ...NO_OP_CACHE,
      async getByPoint() {
        return {
          rnb_id: 'CACHED1234',
          raw_data: { ...FAKE_BUILDING, rnb_id: 'CACHED1234' },
          bdnb_enrichment: null,
          fetched_at: new Date().toISOString(),
          bdnb_fetched_at: null,
        }
      },
    }
    const result = await lookupByPoint(48.8566, 2.3522, { fetchImpl, cache })
    expect(result?.rnb_id).toBe('CACHED1234')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('lookupById', () => {
  it("hit l'endpoint /buildings/{id}", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(FAKE_BUILDING))
    const result = await lookupById('ABCD1234EFGH', { fetchImpl, cache: NO_OP_CACHE })

    expect(result?.rnb_id).toBe('ABCD1234EFGH')
    const url = String(fetchImpl.mock.calls[0]?.[0])
    expect(url).toContain('/buildings/ABCD1234EFGH/')
  })

  it('rejette un ID trop court', async () => {
    await expect(lookupById('XX', { cache: NO_OP_CACHE })).rejects.toBeInstanceOf(RnbApiError)
  })
})
