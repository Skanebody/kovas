/**
 * Vitest — client TS du microservice mdb-writer (B94).
 *
 * Couvre :
 *   - cas nominal (fetch ok → ArrayBuffer)
 *   - validation Zod fail-fast (pas de fetch émis si pivot invalide)
 *   - erreur HTTP 4xx/5xx → MdbWriterError avec status + body preview
 *   - config manquante → MdbWriterConfigError
 *   - timeout (AbortController) → propagation
 *   - pingMdbWriter health-check
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type MdbWriterConfig,
  MdbWriterConfigError,
  MdbWriterError,
  MdbWriterValidationError,
  convertToMdb,
  pingMdbWriter,
} from './mdb-writer-client'
import type { LicielMissionV4 } from './zip-v4-schema'

function validPivot(overrides: Partial<LicielMissionV4> = {}): LicielMissionV4 {
  return {
    schema_version: '4.0',
    kovas_mission_id: '00000000-0000-4000-8000-000000000001',
    exported_at: '2026-05-26T10:00:00.000Z',
    diagnostician: {
      full_name: 'Benjamin Bel',
      company_name: 'Nexus 1993',
      siret: null,
      cofrac_number: null,
      rcpro_policy_number: null,
    },
    property: {
      type: 'maison',
      address: {
        full: '12 rue de la mer, 76200 Dieppe',
        street_number: '12',
        street_name: 'rue de la mer',
        postcode: '76200',
        city: 'Dieppe',
        insee_code: '76217',
        country: 'FR',
      },
      year_built: 1985,
      surface_total_m2: 95,
      cadastre_parcelle_id: null,
    },
    transaction_context: 'vente',
    contacts: [],
    rooms: [],
    photos: [],
    equipments: [],
    diagnostics: [
      {
        type: 'DPE',
        result_summary: 'Classe D',
        energy_class: 'D',
        ges_class: 'D',
        consumption_kwhep_m2_year: 220,
        emissions_kg_co2_m2_year: 45,
        reserves: [],
        observations: null,
        details: {},
      },
      {
        type: 'ERP',
        result_summary: 'Aucun risque identifié',
        energy_class: null,
        ges_class: null,
        consumption_kwhep_m2_year: null,
        emissions_kg_co2_m2_year: null,
        reserves: [],
        observations: null,
        details: {},
      },
    ],
    voice_notes: [],
    ...overrides,
  }
}

const TEST_CONFIG: MdbWriterConfig = {
  url: 'https://mdb-writer.test.kovas.fr',
  apiKey: 'test-api-key-do-not-use-in-prod',
  timeoutMs: 1000,
}

describe('convertToMdb', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns ArrayBuffer on 200 OK', async () => {
    const mdbBytes = new Uint8Array([0, 1, 0, 0, 83, 116, 97, 110, 100, 97, 114, 100]).buffer
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(mdbBytes, {
        status: 200,
        headers: { 'Content-Type': 'application/x-msaccess' },
      }),
    )

    const result = await convertToMdb(validPivot(), {
      config: TEST_CONFIG,
      fetchImpl: fetchMock as unknown as typeof fetch,
    })

    expect(result).toBeInstanceOf(ArrayBuffer)
    expect(result.byteLength).toBe(12)
    expect(fetchMock).toHaveBeenCalledOnce()
    const call = fetchMock.mock.calls[0]
    const [url, init] = call as [string, RequestInit]
    expect(url).toBe('https://mdb-writer.test.kovas.fr/convert')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>)['X-API-Key']).toBe(TEST_CONFIG.apiKey)
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  it('rejects invalid pivot with MdbWriterValidationError BEFORE issuing fetch', async () => {
    const fetchMock = vi.fn()
    const invalidPivot = { ...validPivot(), schema_version: '3.0' } as unknown as LicielMissionV4

    await expect(
      convertToMdb(invalidPivot, {
        config: TEST_CONFIG,
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(MdbWriterValidationError)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws MdbWriterError on HTTP 401 with body preview', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('Unauthorized: invalid X-API-Key', {
        status: 401,
        statusText: 'Unauthorized',
      }),
    )

    let caught: unknown
    try {
      await convertToMdb(validPivot(), {
        config: TEST_CONFIG,
        fetchImpl: fetchMock as unknown as typeof fetch,
      })
    } catch (e) {
      caught = e
    }

    expect(caught).toBeInstanceOf(MdbWriterError)
    const err = caught as MdbWriterError
    expect(err.status).toBe(401)
    expect(err.bodyPreview).toContain('invalid X-API-Key')
  })

  it('throws MdbWriterError on HTTP 500', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('Internal error while writing .mdb', {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    )

    await expect(
      convertToMdb(validPivot(), {
        config: TEST_CONFIG,
        fetchImpl: fetchMock as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ name: 'MdbWriterError', status: 500 })
  })

  it('throws MdbWriterConfigError when env vars are missing and no config override', async () => {
    // vi.stubEnv with empty string clears the value while passing biome lint
    vi.stubEnv('MDB_WRITER_URL', '')
    vi.stubEnv('MDB_WRITER_API_KEY', '')

    await expect(convertToMdb(validPivot())).rejects.toBeInstanceOf(MdbWriterConfigError)
  })

  it('propagates external AbortSignal to fetch', async () => {
    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
      })
    })
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 5)

    await expect(
      convertToMdb(validPivot(), {
        config: TEST_CONFIG,
        fetchImpl: fetchMock as unknown as typeof fetch,
        signal: ctrl.signal,
      }),
    ).rejects.toThrow()

    expect(fetchMock).toHaveBeenCalled()
  })
})

describe('pingMdbWriter', () => {
  it('returns ok=true on 200 health response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"status":"UP"}', { status: 200 }))
    const result = await pingMdbWriter({
      config: TEST_CONFIG,
      fetchImpl: fetchMock as unknown as typeof fetch,
    })
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
  })

  it('returns ok=false on network error', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    const result = await pingMdbWriter({
      config: TEST_CONFIG,
      fetchImpl: fetchMock as unknown as typeof fetch,
    })
    expect(result.ok).toBe(false)
    expect(result.status).toBe(0)
  })
})
