/**
 * Vitest — wrapper API Recherche d'Entreprises.
 *
 * Couvre :
 *   - SIRET actif avec NAF diagnostic 71.20B → isDiagnosticNAF=true, isActive=true
 *   - SIRET actif avec NAF différent (ex. 4711F commerce) → isDiagnosticNAF=false
 *   - SIRET cessé (etat_administratif='C') → isActive=false
 *   - SIRET introuvable → error='not_found'
 *   - Timeout réseau → error='network'
 *   - 429 rate-limit → error='rate_limit'
 *   - 500 + retry réussi à la 2e tentative
 *   - Format SIRET invalide → error='parse'
 *   - Validation NAF code helpers (normalizeNafCode, isDiagnosticNAF)
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { verifyDiagnosticActivity } from './client'
import { isDiagnosticNAF, normalizeNafCode } from './naf-codes'

const VALID_SIRET_DIAG = '12345678900015'
const VALID_SIRET_COMMERCE = '98765432100012'

function buildResponse(payload: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('verifyDiagnosticActivity', () => {
  it('returns isActive=true, isDiagnosticNAF=true for SIRET 71.20B actif', async () => {
    const fetchSpy = vi.fn(async () =>
      buildResponse({
        results: [
          {
            siren: '123456789',
            nom_complet: 'CABINET DIAG NORMANDIE',
            nom_raison_sociale: 'CABINET DIAG NORMANDIE',
            etat_administratif: 'A',
            activite_principale: '71.20B',
            libelle_activite_principale: 'Analyses, essais et inspections techniques',
            nature_juridique: '5710',
            matching_etablissements: [
              {
                siret: VALID_SIRET_DIAG,
                etat_administratif: 'A',
                activite_principale: '71.20B',
              },
            ],
          },
        ],
      }),
    )
    vi.stubGlobal('fetch', fetchSpy)

    const result = await verifyDiagnosticActivity(VALID_SIRET_DIAG)

    expect(result.found).toBe(true)
    expect(result.isActive).toBe(true)
    expect(result.isDiagnosticNAF).toBe(true)
    expect(result.nafCode).toBe('71.20B')
    expect(result.companyName).toBe('CABINET DIAG NORMANDIE')
    expect(result.legalForm).toBe('5710')
    expect(result.error).toBeUndefined()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('flags NAF mismatch when SIRET is active but activity is commerce (not diagnostic)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        buildResponse({
          results: [
            {
              siren: '987654321',
              nom_complet: 'BOUCHERIE DURAND',
              etat_administratif: 'A',
              activite_principale: '47.11F',
              libelle_activite_principale: 'Hypermarchés',
              matching_etablissements: [
                {
                  siret: VALID_SIRET_COMMERCE,
                  etat_administratif: 'A',
                  activite_principale: '47.11F',
                },
              ],
            },
          ],
        }),
      ),
    )

    const result = await verifyDiagnosticActivity(VALID_SIRET_COMMERCE)
    expect(result.found).toBe(true)
    expect(result.isActive).toBe(true)
    expect(result.isDiagnosticNAF).toBe(false)
    expect(result.nafCode).toBe('47.11F')
  })

  it('accepts NAF 71.12B (ingénierie) as diagnostic activity', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        buildResponse({
          results: [
            {
              siren: '111222333',
              nom_complet: 'CABINET ÉTUDES TECHNIQUES',
              etat_administratif: 'A',
              activite_principale: '71.12B',
              matching_etablissements: [
                {
                  siret: VALID_SIRET_DIAG,
                  etat_administratif: 'A',
                  activite_principale: '71.12B',
                },
              ],
            },
          ],
        }),
      ),
    )

    const result = await verifyDiagnosticActivity(VALID_SIRET_DIAG)
    expect(result.isDiagnosticNAF).toBe(true)
    expect(result.nafCode).toBe('71.12B')
  })

  it('marks isActive=false when etat_administratif=C (cessé)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        buildResponse({
          results: [
            {
              siren: '123456789',
              nom_complet: 'CABINET CLÔT',
              etat_administratif: 'C',
              activite_principale: '71.20B',
              matching_etablissements: [
                {
                  siret: VALID_SIRET_DIAG,
                  etat_administratif: 'C',
                  activite_principale: '71.20B',
                },
              ],
            },
          ],
        }),
      ),
    )

    const result = await verifyDiagnosticActivity(VALID_SIRET_DIAG)
    expect(result.found).toBe(true)
    expect(result.isActive).toBe(false)
    expect(result.isDiagnosticNAF).toBe(true)
  })

  it("returns error='not_found' when results array is empty", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => buildResponse({ results: [], total_results: 0 })))

    const result = await verifyDiagnosticActivity(VALID_SIRET_DIAG)
    expect(result.found).toBe(false)
    expect(result.error).toBe('not_found')
  })

  it("returns error='parse' when SIRET format is invalid", async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)

    const result = await verifyDiagnosticActivity('NOT-A-SIRET')
    expect(result.error).toBe('parse')
    expect(result.found).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("returns error='rate_limit' on HTTP 429 without retry", async () => {
    const fetchSpy = vi.fn(async () => new Response('rate limited', { status: 429 }))
    vi.stubGlobal('fetch', fetchSpy)

    const result = await verifyDiagnosticActivity(VALID_SIRET_DIAG)
    expect(result.error).toBe('rate_limit')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('retries once on HTTP 500 and succeeds on second attempt', async () => {
    let calls = 0
    const fetchSpy = vi.fn(async () => {
      calls++
      if (calls === 1) return new Response('boom', { status: 500 })
      return buildResponse({
        results: [
          {
            siren: '123456789',
            nom_complet: 'CABINET RETRY',
            etat_administratif: 'A',
            activite_principale: '71.20B',
            matching_etablissements: [
              {
                siret: VALID_SIRET_DIAG,
                etat_administratif: 'A',
                activite_principale: '71.20B',
              },
            ],
          },
        ],
      })
    })
    vi.stubGlobal('fetch', fetchSpy)

    const result = await verifyDiagnosticActivity(VALID_SIRET_DIAG)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(result.found).toBe(true)
    expect(result.isDiagnosticNAF).toBe(true)
  })

  it("returns error='network' on AbortError (timeout)", async () => {
    const fetchSpy = vi.fn(async () => {
      const err = new Error('aborted')
      err.name = 'AbortError'
      throw err
    })
    vi.stubGlobal('fetch', fetchSpy)

    const result = await verifyDiagnosticActivity(VALID_SIRET_DIAG, { enableRetry: false })
    expect(result.error).toBe('network')
    expect(result.found).toBe(false)
  })

  it('cleans whitespace from SIRET input', async () => {
    let capturedUrl: string | null = null
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        capturedUrl = typeof input === 'string' ? input : input.toString()
        return buildResponse({ results: [] })
      }),
    )

    const result = await verifyDiagnosticActivity('123 4567 8900 015')
    expect(result.siret).toBe(VALID_SIRET_DIAG)
    expect(capturedUrl).toContain(VALID_SIRET_DIAG)
    expect(capturedUrl).not.toContain(' ')
  })
})

describe('NAF code helpers', () => {
  it('normalizes 7120B → 71.20B', () => {
    expect(normalizeNafCode('7120B')).toBe('71.20B')
  })

  it('keeps 71.20B as-is', () => {
    expect(normalizeNafCode('71.20B')).toBe('71.20B')
  })

  it('returns null for garbage input', () => {
    expect(normalizeNafCode('foo')).toBeNull()
    expect(normalizeNafCode(null)).toBeNull()
    expect(normalizeNafCode('')).toBeNull()
  })

  it('isDiagnosticNAF accepts 71.20B and 71.12B', () => {
    expect(isDiagnosticNAF('71.20B')).toBe(true)
    expect(isDiagnosticNAF('7120B')).toBe(true)
    expect(isDiagnosticNAF('71.12B')).toBe(true)
    expect(isDiagnosticNAF('7112B')).toBe(true)
  })

  it('isDiagnosticNAF rejects 71.20A (contrôle automobile)', () => {
    expect(isDiagnosticNAF('71.20A')).toBe(false)
    expect(isDiagnosticNAF('7120A')).toBe(false)
  })

  it('isDiagnosticNAF rejects unrelated codes', () => {
    expect(isDiagnosticNAF('47.11F')).toBe(false)
    expect(isDiagnosticNAF(null)).toBe(false)
  })
})
