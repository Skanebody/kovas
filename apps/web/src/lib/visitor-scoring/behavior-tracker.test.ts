import { describe, expect, it } from 'vitest'
import { buildEmptyBehavior, mergeBehaviorWithPageView } from './behavior-tracker'

describe('buildEmptyBehavior', () => {
  it('retourne un state initial cohérent (tous booleans à false, counts à 0)', () => {
    const b = buildEmptyBehavior('sess_abc')
    expect(b.session_id).toBe('sess_abc')
    expect(b.is_authenticated).toBe(false)
    expect(b.is_returning_visitor).toBe(false)
    expect(b.sessions_count).toBe(1)
    expect(b.utm_source).toBe('unknown')
    expect(b.utm_campaign).toBeNull()
    expect(b.pages_viewed).toEqual([])
    expect(b.page_count).toBe(0)
    expect(b.has_visited_pricing).toBe(false)
    expect(b.has_visited_features).toBe(false)
    expect(b.has_visited_calculator).toBe(false)
    expect(b.time_on_site_seconds).toBe(0)
    expect(b.scroll_depth_max).toBe(0)
    expect(b.videos_watched_count).toBe(0)
    expect(b.has_signed_up_newsletter).toBe(false)
    expect(b.has_started_signup_flow).toBe(false)
    expect(b.has_submitted_quote_request).toBe(false)
  })

  it('le state est sérialisable en JSON (pas de référence circulaire)', () => {
    const b = buildEmptyBehavior('sess_json')
    expect(() => JSON.stringify(b)).not.toThrow()
  })
})

describe('mergeBehaviorWithPageView — détection routes', () => {
  const baseB = buildEmptyBehavior('sess_routes')

  it('détecte /tarifs (et /pricing alias)', () => {
    const a = mergeBehaviorWithPageView(baseB, '/tarifs', 10, 0)
    expect(a.has_visited_pricing).toBe(true)

    const b = mergeBehaviorWithPageView(baseB, '/pricing', 10, 0)
    expect(b.has_visited_pricing).toBe(true)
  })

  it('détecte /fonctionnalites (et /features alias)', () => {
    const a = mergeBehaviorWithPageView(baseB, '/fonctionnalites', 10, 0)
    expect(a.has_visited_features).toBe(true)

    const b = mergeBehaviorWithPageView(baseB, '/features', 10, 0)
    expect(b.has_visited_features).toBe(true)
  })

  it('détecte /blog/* et /guide/* (préfixe)', () => {
    const a = mergeBehaviorWithPageView(baseB, '/blog/dpe-2026', 10, 0)
    expect(a.has_visited_blog_or_guides).toBe(true)

    const b = mergeBehaviorWithPageView(baseB, '/guide/amiante', 10, 0)
    expect(b.has_visited_blog_or_guides).toBe(true)
  })

  it('détecte /a-propos (et /about alias)', () => {
    const a = mergeBehaviorWithPageView(baseB, '/a-propos', 10, 0)
    expect(a.has_visited_testimonials).toBe(true)

    const b = mergeBehaviorWithPageView(baseB, '/about', 10, 0)
    expect(b.has_visited_testimonials).toBe(true)
  })

  it('détecte /calculateur-dpe-gratuit', () => {
    const a = mergeBehaviorWithPageView(baseB, '/calculateur-dpe-gratuit', 10, 0)
    expect(a.has_visited_calculator).toBe(true)
  })

  it('détecte /observatoire', () => {
    const a = mergeBehaviorWithPageView(baseB, '/observatoire', 10, 0)
    expect(a.has_visited_observatory).toBe(true)
  })

  it('détecte /trouver-un-diagnostiqueur/* (préfixe)', () => {
    const a = mergeBehaviorWithPageView(baseB, '/trouver-un-diagnostiqueur/75/paris', 10, 0)
    expect(a.has_visited_annuaire).toBe(true)
  })

  it("ne détecte aucun flag sur une route inconnue (ex: '/contact')", () => {
    const a = mergeBehaviorWithPageView(baseB, '/contact', 10, 0)
    expect(a.has_visited_pricing).toBe(false)
    expect(a.has_visited_features).toBe(false)
    expect(a.has_visited_blog_or_guides).toBe(false)
    expect(a.has_visited_testimonials).toBe(false)
    expect(a.has_visited_calculator).toBe(false)
    expect(a.has_visited_observatory).toBe(false)
    expect(a.has_visited_annuaire).toBe(false)
    expect(a.page_count).toBe(1)
  })

  it('détection case-insensitive et trailing slash', () => {
    const a = mergeBehaviorWithPageView(baseB, '/TARIFS/', 10, 0)
    expect(a.has_visited_pricing).toBe(true)
    const b = mergeBehaviorWithPageView(baseB, '/A-Propos', 10, 0)
    expect(b.has_visited_testimonials).toBe(true)
  })
})

describe('mergeBehaviorWithPageView — cumul time/scroll/pages', () => {
  it('cumule le time_on_site_seconds', () => {
    let b = buildEmptyBehavior('sess_t')
    b = mergeBehaviorWithPageView(b, '/', 30, 20)
    b = mergeBehaviorWithPageView(b, '/tarifs', 60, 50)
    expect(b.time_on_site_seconds).toBe(90)
  })

  it('clamp time négatif à 0', () => {
    let b = buildEmptyBehavior('sess_neg')
    b = mergeBehaviorWithPageView(b, '/', -5, 20)
    expect(b.time_on_site_seconds).toBe(0)
  })

  it('scroll_depth_max prend le max (jamais le delta)', () => {
    let b = buildEmptyBehavior('sess_s')
    b = mergeBehaviorWithPageView(b, '/', 10, 60)
    b = mergeBehaviorWithPageView(b, '/tarifs', 10, 30) // scroll bas après → garde 60
    expect(b.scroll_depth_max).toBe(60)
    b = mergeBehaviorWithPageView(b, '/features', 10, 90) // plus haut → update
    expect(b.scroll_depth_max).toBe(90)
  })

  it('scroll clampé 0-100 même si valeur out-of-range', () => {
    let b = buildEmptyBehavior('sess_clamp')
    b = mergeBehaviorWithPageView(b, '/', 10, 150)
    expect(b.scroll_depth_max).toBe(100)
    b = mergeBehaviorWithPageView(b, '/x', 10, -20)
    expect(b.scroll_depth_max).toBe(100) // pas dégradé
  })

  it('déduplique les pages visitées (même path 2× = 1 entry)', () => {
    let b = buildEmptyBehavior('sess_d')
    b = mergeBehaviorWithPageView(b, '/tarifs', 10, 0)
    b = mergeBehaviorWithPageView(b, '/tarifs', 20, 0)
    b = mergeBehaviorWithPageView(b, '/fonctionnalites', 30, 0)
    expect(b.pages_viewed).toHaveLength(2)
    expect(b.page_count).toBe(2)
    // time toujours cumulé même si page déjà vue
    expect(b.time_on_site_seconds).toBe(60)
  })

  it('dédup tolérante au trailing slash et à la casse (path normalisé)', () => {
    let b = buildEmptyBehavior('sess_norm')
    b = mergeBehaviorWithPageView(b, '/tarifs', 10, 0)
    b = mergeBehaviorWithPageView(b, '/TARIFS/', 10, 0)
    expect(b.pages_viewed).toHaveLength(1)
  })

  it('opérations immuables — input not mutated', () => {
    const initial = buildEmptyBehavior('sess_imm')
    const initial_pages = initial.pages_viewed
    const merged = mergeBehaviorWithPageView(initial, '/tarifs', 10, 0)
    expect(initial.pages_viewed).toBe(initial_pages)
    expect(initial.pages_viewed).toHaveLength(0)
    expect(merged.pages_viewed).toHaveLength(1)
  })

  it('plusieurs pages → tous les flags accumulés', () => {
    let b = buildEmptyBehavior('sess_multi')
    b = mergeBehaviorWithPageView(b, '/tarifs', 30, 50)
    b = mergeBehaviorWithPageView(b, '/fonctionnalites', 30, 60)
    b = mergeBehaviorWithPageView(b, '/calculateur-dpe-gratuit', 60, 80)
    expect(b.has_visited_pricing).toBe(true)
    expect(b.has_visited_features).toBe(true)
    expect(b.has_visited_calculator).toBe(true)
    expect(b.page_count).toBe(3)
    expect(b.time_on_site_seconds).toBe(120)
    expect(b.scroll_depth_max).toBe(80)
  })
})
