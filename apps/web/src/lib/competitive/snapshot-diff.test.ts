import { describe, expect, it } from 'vitest'
import { diffSnapshots } from './snapshot-diff'
import type { PageSnapshot } from './snapshot-extractor'

function makeSnap(overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    url: 'https://www.liciel.com',
    fetched_at: '2026-05-26T08:00:00.000Z',
    title: 'Liciel — Logiciel diagnostic',
    meta_description: 'Le leader du diagnostic immobilier',
    h1: 'Le logiciel n°1',
    h2_list: ['Diagnostics', 'Tarifs', 'Avis clients'],
    prices_eur_detected: [49, 89, 149],
    cta_texts: ['Essayer', 'Commencer'],
    feature_keywords: ['dpe', 'amiante', 'plomb'],
    social_proof_count: 5000,
    raw_text_length: 1200,
    content_hash: 'hash-v1',
    ...overrides,
  }
}

describe('diffSnapshots — pas de changement', () => {
  it('renvoie has_changes=false et is_significant=false sur snapshots identiques', () => {
    const prev = makeSnap()
    const curr = makeSnap({ fetched_at: '2026-05-27T08:00:00.000Z' })
    const diff = diffSnapshots(prev, curr, 'liciel')
    expect(diff.has_changes).toBe(false)
    expect(diff.is_significant).toBe(false)
    expect(diff.changes).toEqual([])
    expect(diff.summary).toContain('aucun changement')
    expect(diff.summary).toContain('Liciel')
  })

  it('garde les timestamps previous/current', () => {
    const prev = makeSnap({ fetched_at: '2026-05-26T08:00:00.000Z' })
    const curr = makeSnap({ fetched_at: '2026-05-27T08:00:00.000Z' })
    const diff = diffSnapshots(prev, curr, 'liciel')
    expect(diff.previous_fetched_at).toBe('2026-05-26T08:00:00.000Z')
    expect(diff.current_fetched_at).toBe('2026-05-27T08:00:00.000Z')
  })
})

describe('diffSnapshots — changements strategic', () => {
  it('détecte title_changed avec severity strategic', () => {
    const prev = makeSnap()
    const curr = makeSnap({ title: 'Liciel — Nouveau positionnement IA' })
    const diff = diffSnapshots(prev, curr, 'liciel')
    const change = diff.changes.find((c) => c.type === 'title_changed')
    expect(change).toBeDefined()
    expect(change?.severity).toBe('strategic')
    expect(change?.before).toBe('Liciel — Logiciel diagnostic')
    expect(change?.after).toBe('Liciel — Nouveau positionnement IA')
    expect(diff.is_significant).toBe(true)
  })

  it('détecte h1_changed avec severity strategic', () => {
    const prev = makeSnap()
    const curr = makeSnap({ h1: "Le n°1 de l'IA en diagnostic" })
    const diff = diffSnapshots(prev, curr, 'liciel')
    const change = diff.changes.find((c) => c.type === 'h1_changed')
    expect(change?.severity).toBe('strategic')
    expect(diff.is_significant).toBe(true)
  })

  it('détecte price_added quand un nouveau prix apparaît', () => {
    const prev = makeSnap({ prices_eur_detected: [49, 89] })
    const curr = makeSnap({ prices_eur_detected: [49, 89, 199] })
    const diff = diffSnapshots(prev, curr, 'liciel')
    const change = diff.changes.find((c) => c.type === 'price_added')
    expect(change).toBeDefined()
    expect(change?.after).toBe(199)
    expect(change?.severity).toBe('strategic')
    expect(diff.is_significant).toBe(true)
  })

  it('détecte price_removed quand un prix disparaît', () => {
    const prev = makeSnap({ prices_eur_detected: [49, 89, 149] })
    const curr = makeSnap({ prices_eur_detected: [49, 89] })
    const diff = diffSnapshots(prev, curr, 'liciel')
    const change = diff.changes.find((c) => c.type === 'price_removed')
    expect(change).toBeDefined()
    expect(change?.before).toBe(149)
    expect(change?.severity).toBe('strategic')
  })

  it('détecte price_changed (>5%) sur même cardinalité', () => {
    const prev = makeSnap({ prices_eur_detected: [49, 89, 149] })
    const curr = makeSnap({ prices_eur_detected: [39, 79, 149] })
    const diff = diffSnapshots(prev, curr, 'liciel')
    // 49→39 et 89→79 sont des changements >5%
    const changes = diff.changes.filter((c) => c.type === 'price_changed')
    expect(changes.length).toBeGreaterThanOrEqual(1)
    for (const c of changes) {
      expect(c.severity).toBe('strategic')
    }
  })

  it('ignore variation prix <5%', () => {
    // 100→102 = 2%, sous le seuil
    const prev = makeSnap({ prices_eur_detected: [100] })
    const curr = makeSnap({ prices_eur_detected: [102] })
    const diff = diffSnapshots(prev, curr, 'liciel')
    // En plus de price_changed potentiel, set diff donne price_added(102) + price_removed(100)
    const priceChanged = diff.changes.find((c) => c.type === 'price_changed')
    expect(priceChanged).toBeUndefined()
  })
})

describe('diffSnapshots — changements major', () => {
  it('détecte meta_description_changed avec severity major', () => {
    const prev = makeSnap()
    const curr = makeSnap({ meta_description: 'Nouveau slogan compétitif' })
    const diff = diffSnapshots(prev, curr, 'liciel')
    const change = diff.changes.find((c) => c.type === 'meta_description_changed')
    expect(change?.severity).toBe('major')
    expect(diff.is_significant).toBe(true)
  })

  it('détecte social_proof_jumped (+50% ou plus)', () => {
    const prev = makeSnap({ social_proof_count: 1000 })
    const curr = makeSnap({ social_proof_count: 2000 })
    const diff = diffSnapshots(prev, curr, 'liciel')
    const change = diff.changes.find((c) => c.type === 'social_proof_jumped')
    expect(change).toBeDefined()
    expect(change?.severity).toBe('major')
    expect(change?.before).toBe(1000)
    expect(change?.after).toBe(2000)
  })

  it('ignore social_proof croissance < 50%', () => {
    const prev = makeSnap({ social_proof_count: 1000 })
    const curr = makeSnap({ social_proof_count: 1200 })
    const diff = diffSnapshots(prev, curr, 'liciel')
    const change = diff.changes.find((c) => c.type === 'social_proof_jumped')
    expect(change).toBeUndefined()
  })

  it('ignore social_proof si previous=0', () => {
    const prev = makeSnap({ social_proof_count: 0 })
    const curr = makeSnap({ social_proof_count: 500 })
    const diff = diffSnapshots(prev, curr, 'liciel')
    const change = diff.changes.find((c) => c.type === 'social_proof_jumped')
    expect(change).toBeUndefined()
  })
})

describe('diffSnapshots — changements minor', () => {
  it('détecte h2_added et h2_removed', () => {
    const prev = makeSnap({ h2_list: ['Diagnostics', 'Tarifs'] })
    const curr = makeSnap({ h2_list: ['Diagnostics', 'Témoignages'] })
    const diff = diffSnapshots(prev, curr, 'liciel')
    const added = diff.changes.find((c) => c.type === 'h2_added')
    const removed = diff.changes.find((c) => c.type === 'h2_removed')
    expect(added?.after).toBe('Témoignages')
    expect(added?.severity).toBe('minor')
    expect(removed?.before).toBe('Tarifs')
    expect(removed?.severity).toBe('minor')
  })

  it('non significatif si uniquement minor changes', () => {
    const prev = makeSnap({ h2_list: ['A', 'B'] })
    const curr = makeSnap({ h2_list: ['A', 'C'] })
    const diff = diffSnapshots(prev, curr, 'liciel')
    expect(diff.has_changes).toBe(true)
    expect(diff.is_significant).toBe(false)
  })

  it('détecte cta_added et cta_removed', () => {
    const prev = makeSnap({ cta_texts: ['Essayer', 'Commencer'] })
    const curr = makeSnap({ cta_texts: ['Essayer', 'Démo gratuite'] })
    const diff = diffSnapshots(prev, curr, 'liciel')
    expect(diff.changes.find((c) => c.type === 'cta_added')?.after).toBe('Démo gratuite')
    expect(diff.changes.find((c) => c.type === 'cta_removed')?.before).toBe('Commencer')
  })

  it('détecte feature_added et feature_removed', () => {
    const prev = makeSnap({ feature_keywords: ['dpe', 'amiante'] })
    const curr = makeSnap({ feature_keywords: ['dpe', 'amiante', 'ia', 'vision'] })
    const diff = diffSnapshots(prev, curr, 'liciel')
    const adds = diff.changes.filter((c) => c.type === 'feature_added')
    expect(adds.length).toBe(2)
    expect(adds.map((c) => c.after)).toEqual(expect.arrayContaining(['ia', 'vision']))
  })
})

describe('diffSnapshots — content_hash et fallback info', () => {
  it('ajoute content_hash_changed uniquement si aucun autre signal', () => {
    const prev = makeSnap({ content_hash: 'h-old' })
    const curr = makeSnap({ content_hash: 'h-new' })
    const diff = diffSnapshots(prev, curr, 'liciel')
    expect(diff.changes).toHaveLength(1)
    expect(diff.changes[0]?.type).toBe('content_hash_changed')
    expect(diff.changes[0]?.severity).toBe('info')
    expect(diff.is_significant).toBe(false)
  })

  it("n'ajoute PAS content_hash_changed si un autre signal existe", () => {
    const prev = makeSnap({ content_hash: 'h-old' })
    const curr = makeSnap({
      content_hash: 'h-new',
      title: 'Nouveau titre stratégique',
    })
    const diff = diffSnapshots(prev, curr, 'liciel')
    const hashChange = diff.changes.find((c) => c.type === 'content_hash_changed')
    expect(hashChange).toBeUndefined()
  })
})

describe('diffSnapshots — summary', () => {
  it('contient le nom du concurrent et le compte de changements significatifs', () => {
    const prev = makeSnap()
    const curr = makeSnap({
      title: 'Nouveau positionnement',
      prices_eur_detected: [29, 89, 149],
    })
    const diff = diffSnapshots(prev, curr, 'liciel')
    expect(diff.summary).toContain('Liciel')
    // 1 title + 2 price events (added 29, removed 49) = au moins 2 significatifs
    expect(diff.summary).toMatch(/significatif/i)
  })

  it("mentionne 'changement(s) mineur(s)' si que des minors", () => {
    const prev = makeSnap({ h2_list: ['A'] })
    const curr = makeSnap({ h2_list: ['B'] })
    const diff = diffSnapshots(prev, curr, 'liciel')
    expect(diff.summary).toContain('mineur')
  })

  it('inclut le nom du concurrent OBBC pour un diff OBBC', () => {
    const prev = makeSnap({ url: 'https://www.obbc.fr' })
    const curr = makeSnap({ url: 'https://www.obbc.fr', title: 'OBBC nouveau' })
    const diff = diffSnapshots(prev, curr, 'obbc')
    expect(diff.summary).toContain('OBBC')
  })
})

describe('diffSnapshots — métadonnées de retour', () => {
  it('garde competitor_slug et url', () => {
    const prev = makeSnap()
    const curr = makeSnap()
    const diff = diffSnapshots(prev, curr, 'analysimmo')
    expect(diff.competitor_slug).toBe('analysimmo')
    expect(diff.url).toBe(curr.url)
  })

  it('combine plusieurs changements en un seul diff', () => {
    const prev = makeSnap()
    const curr = makeSnap({
      title: 'Nouveau titre',
      meta_description: 'Nouvelle meta',
      h2_list: ['Diagnostics', 'Tarifs', 'IA'],
      prices_eur_detected: [49, 89, 149, 299],
    })
    const diff = diffSnapshots(prev, curr, 'liciel')
    expect(diff.has_changes).toBe(true)
    expect(diff.is_significant).toBe(true)
    expect(diff.changes.length).toBeGreaterThanOrEqual(4)
    // Au moins 1 strategic
    expect(diff.changes.some((c) => c.severity === 'strategic')).toBe(true)
    // Au moins 1 major
    expect(diff.changes.some((c) => c.severity === 'major')).toBe(true)
  })
})
