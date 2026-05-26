import { describe, expect, it } from 'vitest'
import { mapToPrefillResult } from '../prefill'
import type { BdnbEnrichment, RnbBuilding } from '../types'

const META = {
  rnbFetchedAt: '2026-05-26T10:00:00.000Z',
  bdnbFetchedAt: '2026-05-26T10:00:01.000Z',
  degraded: false,
}

const RNB: RnbBuilding = {
  rnb_id: 'ABCD1234EFGH',
  point: { type: 'Point', coordinates: [2.3522, 48.8566] },
}

describe('mapToPrefillResult', () => {
  it('renvoie uniquement rnb_id si pas de BDNB', () => {
    const r = mapToPrefillResult(RNB, null, META)
    expect(r.rnb_id).toBe('ABCD1234EFGH')
    expect(r.year_built).toBeUndefined()
    expect(r.meta.bdnb_fetched_at).toBeNull()
  })

  it('mappe annee_construction avec confiance 1.0', () => {
    const bdnb: BdnbEnrichment = { annee_construction: 1972 }
    const r = mapToPrefillResult(RNB, bdnb, META)
    expect(r.year_built?.value).toBe(1972)
    expect(r.year_built?.confidence).toBe(1.0)
    expect(r.year_built?.source).toBe('bdnb')
  })

  it('mappe surface_habitable_estimee_m2 avec confiance 0.7 (estimation)', () => {
    const bdnb: BdnbEnrichment = { surface_habitable_estimee_m2: 85 }
    const r = mapToPrefillResult(RNB, bdnb, META)
    expect(r.surface_total?.value).toBe(85)
    expect(r.surface_total?.confidence).toBe(0.7)
  })

  it('mappe type_batiment + type_habitation vers property_type KOVAS', () => {
    const cases: Array<[BdnbEnrichment, string]> = [
      [{ type_batiment: 'logement', type_habitation: 'individuel' }, 'maison'],
      [{ type_batiment: 'logement', type_habitation: 'collectif' }, 'appartement'],
      [{ type_batiment: 'bureau' }, 'bureau'],
      [{ type_batiment: 'commerce' }, 'local_commercial'],
      [{ type_batiment: 'industrie' }, 'autre'],
    ]
    for (const [bdnb, expected] of cases) {
      const r = mapToPrefillResult(RNB, bdnb, META)
      expect(r.property_type?.value).toBe(expected)
    }
  })

  it('calcule asbestos_probable=true pour bâti < 1997', () => {
    const r = mapToPrefillResult(RNB, { annee_construction: 1985 }, META)
    expect(r.asbestos_probable?.value).toBe(true)
    expect(r.asbestos_probable?.confidence).toBeGreaterThan(0.8)
  })

  it('calcule asbestos_probable=false pour bâti > 2005', () => {
    const r = mapToPrefillResult(RNB, { annee_construction: 2015 }, META)
    expect(r.asbestos_probable?.value).toBe(false)
  })

  it('asbestos confidence faible (0.5) entre 1997 et 2005 (zone grise)', () => {
    const r = mapToPrefillResult(RNB, { annee_construction: 2000 }, META)
    expect(r.asbestos_probable?.value).toBe(true)
    expect(r.asbestos_probable?.confidence).toBeLessThan(0.7)
  })

  it('calcule lead_probable=true pour bâti < 1949', () => {
    const r = mapToPrefillResult(RNB, { annee_construction: 1935 }, META)
    expect(r.lead_probable?.value).toBe(true)
    expect(r.lead_probable?.confidence).toBeGreaterThan(0.9)
  })

  it('calcule lead_probable=false pour bâti >= 1949', () => {
    const r = mapToPrefillResult(RNB, { annee_construction: 1970 }, META)
    expect(r.lead_probable?.value).toBe(false)
  })

  it('utilise le champ direct BDNB presence_amiante_probable si fourni', () => {
    const r = mapToPrefillResult(RNB, { presence_amiante_probable: false }, META)
    expect(r.asbestos_probable?.value).toBe(false)
    expect(r.asbestos_probable?.confidence).toBeGreaterThan(0.8)
  })

  it('ignore les classes DPE invalides (champs corrompus)', () => {
    const r = mapToPrefillResult(RNB, { classe_dpe: 'Z' }, META)
    expect(r.dpe_class).toBeUndefined()
  })

  it('accepte les classes DPE A-G', () => {
    const r = mapToPrefillResult(RNB, { classe_dpe: 'C' }, META)
    expect(r.dpe_class?.value).toBe('C')
  })

  it('marque degraded=true dans meta si BDNB a échoué', () => {
    const r = mapToPrefillResult(RNB, null, { ...META, degraded: true })
    expect(r.meta.degraded).toBe(true)
  })

  it('ignore annee_construction farfelue (< 1000)', () => {
    const r = mapToPrefillResult(RNB, { annee_construction: 0 }, META)
    expect(r.year_built).toBeUndefined()
  })
})
