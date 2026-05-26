/**
 * Vitest — Extension wrapper Géorisques (Radon / PPRI / Argiles / Cavités).
 *
 * Tests des 4 nouvelles fonctions ajoutées au wrapper :
 *   - getRadonRisk(codeInsee)
 *   - getPPRI(codeInsee)
 *   - getArgilesRisk(lat, lng)
 *   - getCavitesNearby(lat, lng, rayonM)
 *
 * Stratégie : mock `global.fetch` (pas de MSW pour rester aligné sur le pattern
 * `unified-profile.test.ts` du même paquet — moins de surface, plus rapide).
 *
 * Couvre :
 *   - Chemin happy (payload nominal)
 *   - Variantes de payload (libelle string vs objet, classe vs niveau)
 *   - Erreurs HTTP 4xx (404 commune absente) → retour null/[]
 *   - Erreurs 5xx avec retry (1 retry → 2 appels max)
 *   - Erreurs réseau (catch path)
 *   - Validation entrées (code_insee vide, lat/lng NaN)
 *   - Obligation IAL (classe 3 / aléa fort)
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GEORISQUES_SOURCE_LABEL,
  getArgilesRisk,
  getCavitesNearby,
  getPPRI,
  getRadonRisk,
} from './georisques'

function mockFetchSequence(responses: Array<Response | Error>): void {
  let i = 0
  vi.spyOn(global, 'fetch').mockImplementation(() => {
    const next = responses[Math.min(i, responses.length - 1)]
    i += 1
    if (next instanceof Error) return Promise.reject(next)
    return Promise.resolve(next as Response)
  })
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as Response
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ─── getRadonRisk ──────────────────────────────────────────────────────────

describe('getRadonRisk', () => {
  it('returns null for empty code INSEE', async () => {
    const res = await getRadonRisk('')
    expect(res).toBeNull()
  })

  it('parses classe_potentiel 3 → obligation IAL true', async () => {
    mockFetchSequence([jsonResponse({ classe_potentiel: 3 })])
    const res = await getRadonRisk('76217')
    expect(res).not.toBeNull()
    expect(res?.classe).toBe(3)
    expect(res?.obligationIAL).toBe(true)
    expect(res?.codeInsee).toBe('76217')
    expect(res?.source).toBe(GEORISQUES_SOURCE_LABEL)
  })

  it('classe 1 → obligation IAL false', async () => {
    mockFetchSequence([jsonResponse({ classe_potentiel: 1 })])
    const res = await getRadonRisk('75056')
    expect(res?.classe).toBe(1)
    expect(res?.obligationIAL).toBe(false)
  })

  it('handles wrapped payload { data: { classe: 2 } }', async () => {
    mockFetchSequence([jsonResponse({ data: { classe: 2 } })])
    const res = await getRadonRisk('69123')
    expect(res?.classe).toBe(2)
    expect(res?.obligationIAL).toBe(false)
  })

  it('handles wrapped payload { resultat: { niveau: "3" } } (string)', async () => {
    mockFetchSequence([jsonResponse({ resultat: { niveau: '3' } })])
    const res = await getRadonRisk('44109')
    expect(res?.classe).toBe(3)
  })

  it('returns null on 404 (commune absente)', async () => {
    mockFetchSequence([jsonResponse({}, 404)])
    const res = await getRadonRisk('99999')
    expect(res).toBeNull()
  })

  it('retries once on 5xx then succeeds', async () => {
    mockFetchSequence([jsonResponse({}, 500), jsonResponse({ classe_potentiel: 2 })])
    const res = await getRadonRisk('76217')
    expect(res?.classe).toBe(2)
    expect(global.fetch).toHaveBeenCalledTimes(2)
  })

  it('returns null after all retries exhausted', async () => {
    mockFetchSequence([jsonResponse({}, 500), jsonResponse({}, 500), jsonResponse({}, 500)])
    const res = await getRadonRisk('76217')
    expect(res).toBeNull()
  })

  it('returns null on network error', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => Promise.reject(new Error('timeout')))
    const res = await getRadonRisk('76217', { retries: 0 })
    expect(res).toBeNull()
  })

  it('returns null when payload has no recognizable classe', async () => {
    mockFetchSequence([jsonResponse({ random_key: 'foo' })])
    const res = await getRadonRisk('76217')
    expect(res).toBeNull()
  })
})

// ─── getPPRI ───────────────────────────────────────────────────────────────

describe('getPPRI', () => {
  it('returns empty array for empty code INSEE', async () => {
    const res = await getPPRI('')
    expect(res).toEqual([])
  })

  it('parses a PPRi entry with full metadata', async () => {
    mockFetchSequence([
      jsonResponse({
        data: [
          {
            id_gaspar: 'PPRI_76_001',
            libelle: 'PPRI de la vallée de la Bresle',
            etat: 'Approuvé',
            type_risque: 'inondation',
            date_approbation: '2014-05-12',
            url_fiche: 'https://www.georisques.gouv.fr/risques/ppr/fiche/PPRI_76_001',
          },
        ],
      }),
    ])
    const res = await getPPRI('76217')
    expect(res).toHaveLength(1)
    expect(res[0].id).toBe('PPRI_76_001')
    expect(res[0].libelle).toContain('Bresle')
    expect(res[0].etat).toBe('approuvé')
    expect(res[0].dateApprobation).toBe('2014-05-12')
    expect(res[0].source).toBe(GEORISQUES_SOURCE_LABEL)
  })

  it('filters out non-inondation PPRs', async () => {
    mockFetchSequence([
      jsonResponse({
        data: [
          { libelle: 'PPRI Seine', type_risque: 'inondation' },
          { libelle: 'PPRT Total', type_risque: 'technologique' },
          { libelle: 'PPR mouvement terrain', type_risque: 'mouvement' },
        ],
      }),
    ])
    const res = await getPPRI('76217')
    expect(res).toHaveLength(1)
    expect(res[0].libelle).toContain('Seine')
  })

  it('returns empty array on 404', async () => {
    mockFetchSequence([jsonResponse({}, 404)])
    const res = await getPPRI('99999')
    expect(res).toEqual([])
  })

  it('returns empty array on network error', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => Promise.reject(new Error('network')))
    const res = await getPPRI('76217', { retries: 0 })
    expect(res).toEqual([])
  })

  it('handles missing data key gracefully', async () => {
    mockFetchSequence([jsonResponse({})])
    const res = await getPPRI('76217')
    expect(res).toEqual([])
  })

  it('detects PPRI via code_type_ppr=PPRI even without libelle inondation', async () => {
    mockFetchSequence([
      jsonResponse({
        data: [{ libelle: 'Plan vallée', code_type_ppr: 'PPRI_TYPE_A', etat: 'prescrit' }],
      }),
    ])
    const res = await getPPRI('76217')
    expect(res).toHaveLength(1)
    expect(res[0].etat).toBe('prescrit')
  })
})

// ─── getArgilesRisk ────────────────────────────────────────────────────────

describe('getArgilesRisk', () => {
  it('returns null for NaN coordinates', async () => {
    const res = await getArgilesRisk(Number.NaN, 1.07)
    expect(res).toBeNull()
  })

  it('parses fort → obligation IAL true', async () => {
    mockFetchSequence([jsonResponse({ exposition: 'Fort' })])
    const res = await getArgilesRisk(49.92, 1.07)
    expect(res?.alea).toBe('fort')
    expect(res?.obligationIAL).toBe(true)
    expect(res?.source).toBe(GEORISQUES_SOURCE_LABEL)
  })

  it('parses moyen → obligation IAL true', async () => {
    mockFetchSequence([jsonResponse({ exposition: 'Moyen' })])
    const res = await getArgilesRisk(49.92, 1.07)
    expect(res?.alea).toBe('moyen')
    expect(res?.obligationIAL).toBe(true)
  })

  it('parses faible → obligation IAL false', async () => {
    mockFetchSequence([jsonResponse({ exposition: 'Faible' })])
    const res = await getArgilesRisk(49.92, 1.07)
    expect(res?.alea).toBe('faible')
    expect(res?.obligationIAL).toBe(false)
  })

  it('normalizes "élevé" → fort', async () => {
    mockFetchSequence([jsonResponse({ alea: 'élevé' })])
    const res = await getArgilesRisk(49.92, 1.07)
    expect(res?.alea).toBe('fort')
  })

  it('returns null on unknown alea string', async () => {
    mockFetchSequence([jsonResponse({ exposition: 'inconnu' })])
    const res = await getArgilesRisk(49.92, 1.07)
    expect(res).toBeNull()
  })

  it('returns null on 404', async () => {
    mockFetchSequence([jsonResponse({}, 404)])
    const res = await getArgilesRisk(49.92, 1.07)
    expect(res).toBeNull()
  })

  it('returns null on network error', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => Promise.reject(new Error('timeout')))
    const res = await getArgilesRisk(49.92, 1.07, { retries: 0 })
    expect(res).toBeNull()
  })
})

// ─── getCavitesNearby ──────────────────────────────────────────────────────

describe('getCavitesNearby', () => {
  it('returns empty array for NaN coordinates', async () => {
    const res = await getCavitesNearby(Number.NaN, 1.07)
    expect(res).toEqual([])
  })

  it('caps rayonM to 1000m (silent clamp)', async () => {
    let capturedUrl = ''
    vi.spyOn(global, 'fetch').mockImplementation((input) => {
      capturedUrl = typeof input === 'string' ? input : (input as Request).url
      return Promise.resolve(jsonResponse({ data: [] }))
    })
    await getCavitesNearby(49.92, 1.07, 5000)
    expect(capturedUrl).toContain('rayon=1000')
  })

  it('clamps low rayonM to 10m minimum', async () => {
    let capturedUrl = ''
    vi.spyOn(global, 'fetch').mockImplementation((input) => {
      capturedUrl = typeof input === 'string' ? input : (input as Request).url
      return Promise.resolve(jsonResponse({ data: [] }))
    })
    await getCavitesNearby(49.92, 1.07, 1)
    expect(capturedUrl).toContain('rayon=10')
  })

  it('parses cavites array correctly', async () => {
    mockFetchSequence([
      jsonResponse({
        data: [
          {
            id_cavite: 'BRGM_76_001',
            type: 'carriere',
            libelle: 'Ancienne carrière de craie',
            distance_metres: 245,
          },
          {
            id_cavite: 'BRGM_76_002',
            type: 'souterrain',
            libelle: 'Souterrain abandonné',
            distance_metres: 480,
          },
        ],
      }),
    ])
    const res = await getCavitesNearby(49.92, 1.07, 500)
    expect(res).toHaveLength(2)
    expect(res[0].id).toBe('BRGM_76_001')
    expect(res[0].type).toBe('carriere')
    expect(res[0].distanceM).toBe(245)
    expect(res[0].source).toBe(GEORISQUES_SOURCE_LABEL)
  })

  it('returns empty array on 404', async () => {
    mockFetchSequence([jsonResponse({}, 404)])
    const res = await getCavitesNearby(49.92, 1.07)
    expect(res).toEqual([])
  })

  it('returns empty array on network error', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(() => Promise.reject(new Error('network')))
    const res = await getCavitesNearby(49.92, 1.07, 500, { retries: 0 })
    expect(res).toEqual([])
  })

  it('falls back when distance field absent', async () => {
    mockFetchSequence([
      jsonResponse({
        data: [{ id: 'CAV_X', libelle: 'Cavité sans distance' }],
      }),
    ])
    const res = await getCavitesNearby(49.92, 1.07)
    expect(res).toHaveLength(1)
    expect(res[0].distanceM).toBeNull()
  })
})
