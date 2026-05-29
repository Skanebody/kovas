import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MissionExportData } from '../../build-mission-data'

/**
 * On mocke les deux générateurs lourds (Liciel natif + universel) pour isoler
 * la logique de routage des adaptateurs sans toucher Supabase ni JSZip.
 * Les mocks renvoient des Buffers reconnaissables permettant d'attester
 * quelle voie d'export a été empruntée.
 *
 * `vi.hoisted` garantit que les fns existent avant le hoisting de `vi.mock`.
 */
const { buildLicielZip, buildExportZip } = vi.hoisted(() => ({
  buildLicielZip: vi.fn<(data: MissionExportData) => Promise<Buffer>>(async () =>
    Buffer.from('LICIEL_NATIVE_ZIP'),
  ),
  buildExportZip: vi.fn<(data: MissionExportData) => Promise<Buffer>>(async () =>
    Buffer.from('UNIVERSAL_ZIP'),
  ),
}))

vi.mock('@/lib/liciel/export', () => ({ buildLicielZip }))
vi.mock('@/lib/exports/zip-bundle', () => ({ buildExportZip }))

import { analysimmoAdapter } from '../analysimmo'
import { licielAdapter } from '../liciel'
import { obbcAdapter } from '../obbc'
import { orisAdapter } from '../oris'
import {
  EDITOR_ADAPTERS,
  EDITOR_ADAPTER_IDS,
  getEditorAdapter,
  isEditorAdapterId,
} from '../registry'

function fixture(overrides: Partial<MissionExportData> = {}): MissionExportData {
  return {
    mission: {
      id: 'm1',
      reference: 'DOS-2026-042',
      type: 'dpe_vente',
      status: 'completed',
      scheduled_at: null,
      started_at: null,
      completed_at: null,
      notes: null,
      created_at: '2026-05-28T10:00:00Z',
    },
    property: { address: '12 rue des Lilas', city: 'Dieppe' } as never,
    client: { display_name: 'Dupont Pierre' } as never,
    organization: { name: 'Cabinet Test' } as never,
    rooms: [],
    photos: [],
    voiceNotes: [],
    ownerDocuments: [],
    exportedAt: '2026-05-28T12:00:00Z',
    isTrial: false,
    ...overrides,
  }
}

beforeEach(() => {
  buildLicielZip.mockClear()
  buildExportZip.mockClear()
})

describe('registry', () => {
  it('expose exactement les 4 éditeurs cibles', () => {
    expect(EDITOR_ADAPTER_IDS.sort()).toEqual(['analysimmo', 'liciel', 'obbc', 'oris'])
  })

  it('getEditorAdapter retourne le bon adaptateur par identifiant', () => {
    expect(getEditorAdapter('liciel')).toBe(licielAdapter)
    expect(getEditorAdapter('obbc')).toBe(obbcAdapter)
    expect(getEditorAdapter('analysimmo')).toBe(analysimmoAdapter)
    expect(getEditorAdapter('oris')).toBe(orisAdapter)
  })

  it('getEditorAdapter retourne undefined pour un identifiant inconnu', () => {
    expect(getEditorAdapter('zip')).toBeUndefined()
    expect(getEditorAdapter('inconnu')).toBeUndefined()
    expect(getEditorAdapter('')).toBeUndefined()
  })

  it('isEditorAdapterId discrimine correctement', () => {
    expect(isEditorAdapterId('liciel')).toBe(true)
    expect(isEditorAdapterId('zip')).toBe(false)
  })

  it('le registre couvre tous les ids exposés', () => {
    for (const id of EDITOR_ADAPTER_IDS) {
      expect(EDITOR_ADAPTERS[id].id).toBe(id)
    }
  })
})

describe('liciel adapter (NATIF EXACT)', () => {
  it('est marqué nativeMapping=true', () => {
    expect(licielAdapter.nativeMapping).toBe(true)
  })

  it('délègue à buildLicielZip (et PAS à l’export universel)', async () => {
    const result = await licielAdapter.build(fixture())
    expect(buildLicielZip).toHaveBeenCalledTimes(1)
    expect(buildExportZip).not.toHaveBeenCalled()
    expect(result.buffer.toString()).toBe('LICIEL_NATIVE_ZIP')
    expect(result.mimeType).toBe('application/zip')
    expect(result.filename).toContain('LICIEL-EXPORT')
    expect(result.filename.endsWith('.zip')).toBe(true)
  })
})

describe('adaptateurs fallback universel (OBBC / AnalysImmo / ORIS)', () => {
  const fallbacks = [
    { adapter: obbcAdapter, tag: 'OBBC' },
    { adapter: analysimmoAdapter, tag: 'ANALYSIMMO' },
    { adapter: orisAdapter, tag: 'ORIS' },
  ] as const

  for (const { adapter, tag } of fallbacks) {
    describe(adapter.label, () => {
      it('est marqué nativeMapping=false (pas de mapping natif inventé)', () => {
        expect(adapter.nativeMapping).toBe(false)
      })

      it('délègue à l’export universel et produit un ZIP non vide', async () => {
        buildLicielZip.mockClear()
        buildExportZip.mockClear()
        const result = await adapter.build(fixture())
        expect(buildExportZip).toHaveBeenCalledTimes(1)
        expect(buildLicielZip).not.toHaveBeenCalled()
        expect(result.buffer.length).toBeGreaterThan(0)
        expect(result.buffer.toString()).toBe('UNIVERSAL_ZIP')
        expect(result.mimeType).toBe('application/zip')
      })

      it('nomme le fichier avec le tag éditeur + la référence', () => {
        return adapter.build(fixture()).then((result) => {
          expect(result.filename).toContain(tag)
          expect(result.filename).toContain('DOS-2026-042')
          expect(result.filename.endsWith('.zip')).toBe(true)
        })
      })
    })
  }
})
