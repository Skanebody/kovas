import { describe, expect, it } from 'vitest'
import type { MissionExportData } from '../build-mission-data'
import { generateUniversalXml } from '../xml'

function fixture(overrides: Partial<MissionExportData> = {}): MissionExportData {
  return {
    mission: {
      id: 'm1',
      reference: 'DOS-2026-001',
      type: 'dpe',
      status: 'completed',
      scheduled_at: null,
      started_at: null,
      completed_at: null,
      notes: null,
      created_at: '2026-05-28T10:00:00Z',
    },
    property: { address: '12 rue des Lilas & Co', city: 'Dieppe' } as never,
    client: { display_name: 'Jean <Dupont>' } as never,
    organization: { name: 'Cabinet "Test"' } as never,
    rooms: [{ id: 'r1', name: 'Salon' } as never],
    photos: [],
    voiceNotes: [],
    ownerDocuments: [],
    exportedAt: '2026-05-28T12:00:00Z',
    isTrial: false,
    ...overrides,
  }
}

describe('generateUniversalXml', () => {
  it('produit un document XML bien formé avec déclaration UTF-8', () => {
    const xml = generateUniversalXml(fixture())
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<kovas_export version="1.0">')
    expect(xml.trimEnd().endsWith('</kovas_export>')).toBe(true)
  })

  it('échappe strictement les entités XML (&, <, >, ", \')', () => {
    const xml = generateUniversalXml(fixture())
    // "12 rue des Lilas & Co" → & échappé
    expect(xml).toContain('12 rue des Lilas &amp; Co')
    // "Jean <Dupont>" → < et > échappés
    expect(xml).toContain('Jean &lt;Dupont&gt;')
    // Aucune entité brute non échappée ne doit subsister dans les valeurs.
    expect(xml).not.toContain('Lilas & Co')
    expect(xml).not.toContain('Jean <Dupont>')
  })

  it('rend les compteurs et la référence mission', () => {
    const xml = generateUniversalXml(fixture())
    expect(xml).toContain('<reference>DOS-2026-001</reference>')
    expect(xml).toContain('<photos_count>0</photos_count>')
    expect(xml).toContain('<room>')
  })

  it('gère les sections nulles sans planter (property/client absents)', () => {
    const xml = generateUniversalXml(fixture({ property: null, client: null }))
    expect(xml).toContain('<property>')
    expect(xml).toContain('</property>')
    // Bien formé : autant d'ouvertures que de fermetures de la balise racine.
    expect((xml.match(/<kovas_export/g) ?? []).length).toBe(1)
  })
})
