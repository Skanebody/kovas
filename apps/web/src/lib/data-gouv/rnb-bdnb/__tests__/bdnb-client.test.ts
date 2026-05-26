import { describe, expect, it, vi } from 'vitest'
import { enrichBuilding } from '../bdnb-client'
import { BdnbApiError, type BdnbEnrichment } from '../types'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const FAKE_ENRICHMENT: BdnbEnrichment = {
  batiment_groupe_id: 'ABCD1234EFGH',
  annee_construction: 1968,
  materiau_mur_principal: 'beton',
  materiau_toiture: 'tuile',
  nombre_niveau: 4,
  hauteur_estimee_m: 12.5,
  surface_habitable_estimee_m2: 280,
  classe_dpe: 'E',
  type_batiment: 'logement',
  type_habitation: 'collectif',
}

describe('enrichBuilding', () => {
  it("renvoie l'enrichissement quand BDNB répond un tableau direct", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([FAKE_ENRICHMENT]))
    const result = await enrichBuilding('ABCD1234EFGH', { fetchImpl })

    expect(result?.annee_construction).toBe(1968)
    const url = String(fetchImpl.mock.calls[0]?.[0])
    expect(url).toContain('batiment_groupe')
    expect(url).toContain('eq.ABCD1234EFGH')
  })

  it("renvoie l'enrichissement quand BDNB encapsule dans { data }", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ data: [FAKE_ENRICHMENT] }))
    const result = await enrichBuilding('ABCD1234EFGH', { fetchImpl })
    expect(result?.classe_dpe).toBe('E')
  })

  it("renvoie l'enrichissement quand BDNB encapsule dans { results }", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ results: [FAKE_ENRICHMENT] }))
    const result = await enrichBuilding('ABCD1234EFGH', { fetchImpl })
    expect(result?.materiau_mur_principal).toBe('beton')
  })

  it('renvoie null sur tableau vide (bâtiment non couvert par BDNB)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([]))
    const result = await enrichBuilding('ZZZZ0000ZZZZ', { fetchImpl })
    expect(result).toBeNull()
  })

  it('renvoie null sur 404 (bâtiment absent BDNB)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 404))
    const result = await enrichBuilding('ZZZZ0000ZZZZ', { fetchImpl })
    expect(result).toBeNull()
  })

  it('rejette un ID vide', async () => {
    await expect(enrichBuilding('')).rejects.toBeInstanceOf(BdnbApiError)
  })

  it('retry sur 503 puis succès', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse([FAKE_ENRICHMENT]))

    const result = await enrichBuilding('ABCD1234EFGH', { fetchImpl, maxAttempts: 2 })
    expect(result?.annee_construction).toBe(1968)
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
