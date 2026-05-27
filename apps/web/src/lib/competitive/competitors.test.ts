import { describe, expect, it } from 'vitest'
import { COMPETITORS, type CompetitorSlug, getCompetitor } from './competitors'

describe('COMPETITORS registry', () => {
  it('contient exactement les 6 concurrents attendus', () => {
    expect(COMPETITORS).toHaveLength(6)
    const slugs = COMPETITORS.map((c) => c.slug)
    expect(slugs).toEqual(
      expect.arrayContaining(['liciel', 'obbc', 'analysimmo', 'oris', 'bc2e', 'mhdiag']),
    )
  })

  it('a des slugs uniques', () => {
    const slugs = COMPETITORS.map((c) => c.slug)
    const unique = new Set(slugs)
    expect(unique.size).toBe(slugs.length)
  })

  it('a des URLs homepage en HTTPS pour chaque concurrent', () => {
    for (const c of COMPETITORS) {
      expect(c.homepage_url).toMatch(/^https:\/\//)
    }
  })

  it('marque Liciel et OBBC comme menace majeure', () => {
    const liciel = getCompetitor('liciel')
    const obbc = getCompetitor('obbc')
    expect(liciel?.is_major_threat).toBe(true)
    expect(obbc?.is_major_threat).toBe(true)
  })

  it('marque AnalysImmo, ORIS, BC2E, MH Diag comme concurrents secondaires', () => {
    expect(getCompetitor('analysimmo')?.is_major_threat).toBe(false)
    expect(getCompetitor('oris')?.is_major_threat).toBe(false)
    expect(getCompetitor('bc2e')?.is_major_threat).toBe(false)
    expect(getCompetitor('mhdiag')?.is_major_threat).toBe(false)
  })

  it('a une part de marché Liciel cohérente avec CLAUDE.md (~40-52%)', () => {
    const liciel = getCompetitor('liciel')
    expect(liciel?.market_share_pct).toBeGreaterThanOrEqual(40)
    expect(liciel?.market_share_pct).toBeLessThanOrEqual(52)
  })
})

describe('getCompetitor()', () => {
  it('renvoie le concurrent quand le slug est valide', () => {
    const c = getCompetitor('liciel')
    expect(c).toBeDefined()
    expect(c?.name).toBe('Liciel')
    expect(c?.slug).toBe('liciel')
  })

  it('renvoie undefined pour un slug inconnu (cast volontaire)', () => {
    // @ts-expect-error — test runtime sur slug invalide
    const c = getCompetitor('unknown-vendor' as CompetitorSlug)
    expect(c).toBeUndefined()
  })

  it('peut récupérer les 6 concurrents nominaux', () => {
    const slugs: CompetitorSlug[] = ['liciel', 'obbc', 'analysimmo', 'oris', 'bc2e', 'mhdiag']
    for (const s of slugs) {
      const c = getCompetitor(s)
      expect(c).toBeDefined()
      expect(c?.slug).toBe(s)
    }
  })
})
