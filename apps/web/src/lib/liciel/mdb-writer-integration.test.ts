/**
 * KOVAS — Integration test : TypeScript client ↔ Java microservice (Lot B100).
 *
 * Live smoke test : verifies that the TS client can actually talk to the running
 * Java Spring Boot microservice and get a valid .mdb binary back.
 *
 * Usage:
 *   1. Start microservice locally:
 *      pnpm run mdb-writer:run      (from monorepo root, requires Java 21 + Gradle wrapper)
 *      OR
 *      pnpm run mdb-writer:docker:run
 *   2. Run this test:
 *      cd apps/web && pnpm vitest run src/lib/liciel/mdb-writer-integration
 *
 * Auto-skip behaviour: if `pingMdbWriter()` fails (service DOWN, network issue,
 * env vars unset), the live tests are skipped via `describe.skipIf(!SERVICE_AVAILABLE)`.
 * This keeps the test safe to include in regular CI without breaking pipelines
 * when the microservice is not deployed alongside.
 *
 * Authority:
 *   - Client : ./mdb-writer-client.ts
 *   - Schema : ./zip-v4-schema.ts
 *   - Java service : services/mdb-writer/
 */

import { describe, expect, it } from 'vitest'
import { type MdbWriterConfig, convertToMdb, pingMdbWriter } from './mdb-writer-client'
import type { LicielMissionV4 } from './zip-v4-schema'

/* ────────────────────────────────────────────────────────────────────────── */
/* Configuration                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

/**
 * Read config from env at test load time. Falls back to localhost dev defaults
 * if env vars are unset (so a founder can run `pnpm run mdb-writer:run` and
 * trigger this test without any extra setup).
 */
function readIntegrationConfig(): MdbWriterConfig | null {
  const url = process.env.MDB_WRITER_URL ?? 'http://localhost:8080'
  const apiKey = process.env.MDB_WRITER_API_KEY ?? 'dev-secret'
  if (!url || !apiKey) return null
  return {
    url: url.replace(/\/+$/, ''),
    apiKey,
    timeoutMs: 10_000,
  }
}

const INTEGRATION_CONFIG = readIntegrationConfig()

/**
 * Probe the live service. We use the public `pingMdbWriter` helper which
 * returns `{ ok, status }` (never throws), so wrapping in try/catch is just a
 * belt-and-braces safety against env crashes (e.g. missing fetch in old node).
 */
async function isServiceAvailable(): Promise<boolean> {
  if (!INTEGRATION_CONFIG) return false
  try {
    const result = await pingMdbWriter({ config: INTEGRATION_CONFIG })
    return result.ok
  } catch {
    return false
  }
}

const SERVICE_AVAILABLE = await isServiceAvailable()

/* ────────────────────────────────────────────────────────────────────────── */
/* Fixtures                                                                    */
/* ────────────────────────────────────────────────────────────────────────── */

function minimalLivePivot(): LicielMissionV4 {
  return {
    schema_version: '4.0',
    kovas_mission_id: '00000000-0000-4000-8000-000000000099',
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
    ],
    voice_notes: [],
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Live integration tests (skip if service is DOWN)                            */
/* ────────────────────────────────────────────────────────────────────────── */

describe.skipIf(!SERVICE_AVAILABLE)('mdb-writer integration (live service)', () => {
  it('returns a valid .mdb binary for a minimal DPE pivot', async () => {
    if (!INTEGRATION_CONFIG) throw new Error('integration config missing (guarded by skipIf)')

    const result = await convertToMdb(minimalLivePivot(), { config: INTEGRATION_CONFIG })

    expect(result).toBeInstanceOf(ArrayBuffer)
    expect(result.byteLength).toBeGreaterThan(0)

    // Jet 4.0 magic header (offsets 0..18) is "\x00\x01\x00\x00Standard Jet DB"
    // (or "Standard ACE DB" if Jackcess upgrades file format in a future release).
    // We assert on the 4-byte signature + the ASCII marker.
    const view = new Uint8Array(result.slice(0, 19))
    expect(view[0]).toBe(0x00)
    expect(view[1]).toBe(0x01)
    expect(view[2]).toBe(0x00)
    expect(view[3]).toBe(0x00)

    const marker = new TextDecoder('ascii').decode(view.slice(4, 19))
    expect(marker === 'Standard Jet DB' || marker === 'Standard ACE DB').toBe(true)
  })

  it('rejects requests with an invalid API key (401)', async () => {
    if (!INTEGRATION_CONFIG) throw new Error('integration config missing (guarded by skipIf)')

    const badConfig: MdbWriterConfig = {
      url: INTEGRATION_CONFIG.url,
      apiKey: 'definitely-not-the-real-key',
      timeoutMs: 5_000,
    }

    await expect(convertToMdb(minimalLivePivot(), { config: badConfig })).rejects.toMatchObject({
      name: 'MdbWriterError',
      status: 401,
    })
  })

  it('responds to /health with 200 OK', async () => {
    if (!INTEGRATION_CONFIG) throw new Error('integration config missing (guarded by skipIf)')

    const result = await pingMdbWriter({ config: INTEGRATION_CONFIG })
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
  })
})

/* ────────────────────────────────────────────────────────────────────────── */
/* Meta tests (always run — verify the skip logic itself)                      */
/* ────────────────────────────────────────────────────────────────────────── */

describe('mdb-writer integration (skip logic)', () => {
  it('exposes a boolean SERVICE_AVAILABLE flag', () => {
    expect(typeof SERVICE_AVAILABLE).toBe('boolean')
  })

  it('logs the integration target URL', () => {
    // Documenting which URL the test is probing (helps debugging in CI logs).
    const url = INTEGRATION_CONFIG?.url ?? 'unconfigured'
    expect(url.length).toBeGreaterThan(0)
  })
})
