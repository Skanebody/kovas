import { clearCache } from '@/lib/data-gouv/mes-aides-reno'
import JSZip from 'jszip'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
/**
 * Tests "end-to-end fonctionnels" du flow DPE F/G → annexe Aides Rénovation.
 *
 * Note : il n'y a pas (encore) d'infrastructure Playwright dans ce repo.
 * En attendant l'ajout de `tests/e2e/`, on couvre le flow critique en
 * mode intégration : on simule MissionExportData + on vérifie que
 * `generateAidesAnnexeIfEligible` produit (ou pas) un PDF + payload.
 * MSW intercepte l'appel France Rénov' upstream.
 *
 * Le câblage `zip-bundle.ts → generateAidesAnnexeIfEligible` est
 * indépendamment testé en intégration via un test de bout en bout :
 * on construit un MissionExportData synthétique et on vérifie que le
 * fichier `annexe_aides_renovation.pdf` apparaît dans le ZIP.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { generateAidesAnnexeIfEligible } from '../aides-annexe'
import type { MissionExportData } from '../build-mission-data'
import { buildExportZip } from '../zip-bundle'

const API_BASE = 'https://api.mesaidesreno.beta.gouv.fr'

const server = setupServer()

beforeAll(() => {
  // On laisse les requêtes Supabase passer "unhandled" pour qu'elles échouent
  // proprement : `persistAnnexe` swallow l'erreur, le PDF est quand même
  // retourné. Idem pour la requête de téléchargement des photos (zero photos).
  server.listen({ onUnhandledRequest: 'bypass' })
  // Variables d'env minimales pour les wrappers Supabase.
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://localhost:54321'
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key'
})
afterAll(() => server.close())
beforeEach(() => clearCache())
afterEach(() => server.resetHandlers())

function fixture(overrides: Partial<MissionExportData> = {}): MissionExportData {
  const base: MissionExportData = {
    mission: {
      id: '11111111-1111-1111-1111-111111111111',
      reference: 'MIS-2026-00042',
      type: 'dpe_vente',
      status: 'done',
      scheduled_at: '2026-05-01T09:00:00Z',
      started_at: '2026-05-01T09:15:00Z',
      completed_at: '2026-05-01T10:30:00Z',
      notes: 'DPE: G constaté sur le bien.',
      created_at: '2026-04-30T10:00:00Z',
    },
    property: {
      address: '12 rue des Diagnostics',
      postal_code: '76200',
      city: 'Dieppe',
      property_type: 'maison',
      year_built: 1965,
      surface_total: 95,
      surface_carrez: null,
    },
    client: {
      display_name: 'M. Martin',
      type: 'particulier',
      email: 'martin@example.com',
      phone: null,
      address: null,
    },
    organization: { name: 'Cabinet Test' },
    rooms: [],
    photos: [],
    voiceNotes: [],
    ownerDocuments: [],
    exportedAt: '2026-05-02T08:00:00Z',
    isTrial: false,
  }
  return { ...base, ...overrides }
}

describe('generateAidesAnnexeIfEligible — happy path DPE G', () => {
  it('génère le PDF + payload pour un DPE G', async () => {
    server.use(
      http.post(`${API_BASE}/api/v1/simulate`, () =>
        HttpResponse.json({
          aides: [
            { code: 'maprimerenov', montant: 12_000 },
            { code: 'cee', montant: 1_800 },
            { code: 'eco-ptz', montant: 25_000 },
          ],
        }),
      ),
    )

    const result = await generateAidesAnnexeIfEligible(fixture(), { persist: false })
    expect(result).not.toBeNull()
    expect(result?.dpe_actuel).toBe('G')
    expect(result?.aides.length).toBe(3)
    expect(result?.totalEur).toBeGreaterThan(30_000)
    expect(result?.pdf.byteLength).toBeGreaterThan(500)
    expect(result?.pdf.subarray(0, 4).toString()).toBe('%PDF')
  })
})

describe('generateAidesAnnexeIfEligible — ineligible', () => {
  it('renvoie null pour un DPE C', async () => {
    const data = fixture({
      mission: { ...fixture().mission, notes: 'DPE: C constaté sur le bien.' },
    })
    const result = await generateAidesAnnexeIfEligible(data, { persist: false })
    expect(result).toBeNull()
  })

  it('renvoie null pour une mission Amiante (pas un DPE)', async () => {
    const data = fixture({
      mission: { ...fixture().mission, type: 'amiante_vente' },
    })
    const result = await generateAidesAnnexeIfEligible(data, { persist: false })
    expect(result).toBeNull()
  })

  it('renvoie null si aucune donnée property nécessaire au calcul (pas de code postal)', async () => {
    const data = fixture({
      property: { ...fixture().property!, postal_code: null },
    })
    const result = await generateAidesAnnexeIfEligible(data, { persist: false })
    expect(result).toBeNull()
  })
})

describe('flow ZIP export — DPE F/G', () => {
  it('inclut `annexe_aides_renovation.pdf` dans le ZIP universel quand la mission est F', async () => {
    server.use(
      http.post(`${API_BASE}/api/v1/simulate`, () =>
        HttpResponse.json({
          aides: [
            { code: 'maprimerenov', montant: 8_000 },
            { code: 'cee', montant: 1_500 },
          ],
        }),
      ),
    )
    const data = fixture({
      mission: { ...fixture().mission, notes: 'DPE: F constaté.' },
    })
    const zipBuf = await buildExportZip(data)
    const zip = await JSZip.loadAsync(zipBuf)
    expect(zip.file('annexe_aides_renovation.pdf')).not.toBeNull()
    // PDF non vide
    const pdfFile = zip.file('annexe_aides_renovation.pdf')
    const pdfData = await pdfFile!.async('uint8array')
    expect(pdfData.byteLength).toBeGreaterThan(500)
  })

  it("n'inclut PAS d'annexe pour un DPE C", async () => {
    const data = fixture({
      mission: { ...fixture().mission, notes: 'DPE: C constaté.' },
    })
    const zipBuf = await buildExportZip(data)
    const zip = await JSZip.loadAsync(zipBuf)
    expect(zip.file('annexe_aides_renovation.pdf')).toBeNull()
  })
})
