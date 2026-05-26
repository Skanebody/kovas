import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
/**
 * Tests Vitest pour le wrapper Mes Aides Réno.
 * Mocks HTTP via MSW (Mock Service Worker, mode Node).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { type AideInput, MesAidesRenoError, clearCache, simulateAides } from '../index'

const API_BASE = 'https://api.mesaidesreno.beta.gouv.fr'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

beforeEach(() => {
  clearCache()
})

afterEach(() => {
  server.resetHandlers()
})

const validInput: AideInput = {
  surface_m2: 90,
  annee_construction: 1975,
  dpe_actuel: 'G',
  dpe_projete: 'C',
  revenu_fiscal_reference: 22_000,
  code_postal: '76200',
  type_logement: 'maison',
  occupation: 'proprietaire_occupant',
}

describe('simulateAides — happy path upstream', () => {
  it("appelle l'API et normalise la réponse", async () => {
    server.use(
      http.post(`${API_BASE}/api/v1/simulate`, () =>
        HttpResponse.json({
          aides: [
            {
              code: 'maprimerenov',
              nom: "MaPrimeRénov'",
              montant: 8500,
              conditions: ['Revenu modeste', 'Travaux RGE'],
              url: 'https://france-renov.gouv.fr/aides/maprimerenov',
            },
            {
              code: 'cee',
              nom: 'CEE',
              montant: 1800,
              conditions: ['Fiche CEE éligible'],
            },
            {
              code: 'eco-ptz',
              nom: 'Éco-PTZ',
              montant: 30_000,
              conditions: [],
            },
          ],
        }),
      ),
    )

    const results = await simulateAides(validInput)
    expect(results).toHaveLength(3)
    expect(results[0]?.code).toBe('mpr')
    expect(results[0]?.montant_eur).toBe(8500)
    expect(results[1]?.code).toBe('cee')
    expect(results[2]?.code).toBe('eco_ptz')
    expect(results[2]?.source_url).toContain('eco-pret-taux-zero')
  })

  it('ignore les aides à montant 0 ou inconnues', async () => {
    server.use(
      http.post(`${API_BASE}/api/v1/simulate`, () =>
        HttpResponse.json({
          aides: [
            { code: 'maprimerenov', montant: 5000 },
            { code: 'aide_inconnue', montant: 1000 },
            { code: 'cee', montant: 0 },
          ],
        }),
      ),
    )

    const results = await simulateAides(validInput)
    expect(results).toHaveLength(1)
    expect(results[0]?.code).toBe('mpr')
  })
})

describe('simulateAides — cache 24h', () => {
  it("ne refait pas l'appel pour le même input", async () => {
    let calls = 0
    server.use(
      http.post(`${API_BASE}/api/v1/simulate`, () => {
        calls += 1
        return HttpResponse.json({
          aides: [{ code: 'maprimerenov', montant: 1000 }],
        })
      }),
    )

    await simulateAides(validInput)
    await simulateAides(validInput)
    await simulateAides(validInput)
    expect(calls).toBe(1)
  })

  it("refait l'appel pour un input distinct", async () => {
    let calls = 0
    server.use(
      http.post(`${API_BASE}/api/v1/simulate`, () => {
        calls += 1
        return HttpResponse.json({ aides: [{ code: 'maprimerenov', montant: 1000 }] })
      }),
    )

    await simulateAides(validInput)
    await simulateAides({ ...validInput, surface_m2: 120 })
    expect(calls).toBe(2)
  })
})

describe('simulateAides — retry sur 5xx', () => {
  it('réessaie une fois sur 503 puis renvoie le résultat', async () => {
    let calls = 0
    server.use(
      http.post(`${API_BASE}/api/v1/simulate`, () => {
        calls += 1
        if (calls === 1) return new HttpResponse(null, { status: 503 })
        return HttpResponse.json({ aides: [{ code: 'maprimerenov', montant: 2000 }] })
      }),
    )

    const results = await simulateAides(validInput)
    expect(calls).toBe(2)
    expect(results[0]?.code).toBe('mpr')
  })

  it("tombe sur le fallback local si l'upstream est en 503 persistant", async () => {
    server.use(
      http.post(`${API_BASE}/api/v1/simulate`, () => new HttpResponse(null, { status: 503 })),
    )
    const results = await simulateAides(validInput)
    // Fallback : 5 aides standard
    expect(results.length).toBe(5)
    expect(results.map((r) => r.code)).toEqual(['mpr', 'cee', 'eco_ptz', 'tva_5_5', 'aide_locale'])
    // Tous les montants positifs
    for (const r of results) expect(r.montant_eur).toBeGreaterThan(0)
  })
})

describe('simulateAides — fallback local', () => {
  it('tombe sur le fallback si la réponse upstream est vide', async () => {
    server.use(http.post(`${API_BASE}/api/v1/simulate`, () => HttpResponse.json({ aides: [] })))
    const results = await simulateAides(validInput)
    expect(results.length).toBe(5)
  })

  it('inclut MPR avec un barème plus généreux pour ménage très modeste', async () => {
    server.use(http.post(`${API_BASE}/api/v1/simulate`, () => HttpResponse.error()))
    const veryModeste = await simulateAides({ ...validInput, revenu_fiscal_reference: 14_000 })
    clearCache()
    const intermediaire = await simulateAides({ ...validInput, revenu_fiscal_reference: 50_000 })
    const mprVm = veryModeste.find((a) => a.code === 'mpr')!
    const mprInt = intermediaire.find((a) => a.code === 'mpr')!
    expect(mprVm.montant_eur).toBeGreaterThan(mprInt.montant_eur)
  })

  it('renvoie une liste vide si aucun saut DPE', async () => {
    server.use(http.post(`${API_BASE}/api/v1/simulate`, () => HttpResponse.error()))
    const noJump = await simulateAides({ ...validInput, dpe_actuel: 'C', dpe_projete: 'C' })
    expect(noJump).toEqual([])
  })
})

describe('simulateAides — validation', () => {
  it('refuse une surface invalide', async () => {
    await expect(simulateAides({ ...validInput, surface_m2: 0 })).rejects.toBeInstanceOf(
      MesAidesRenoError,
    )
  })

  it('refuse un code postal mal formé', async () => {
    await expect(simulateAides({ ...validInput, code_postal: '76' })).rejects.toBeInstanceOf(
      MesAidesRenoError,
    )
  })

  it('refuse une année de construction farfelue', async () => {
    await expect(simulateAides({ ...validInput, annee_construction: 1500 })).rejects.toBeInstanceOf(
      MesAidesRenoError,
    )
  })
})
