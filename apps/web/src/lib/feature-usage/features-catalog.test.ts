import { describe, expect, it } from 'vitest'
import {
  FEATURES_CATALOG,
  type FeatureId,
  getFeature,
  getFeaturesByCategory,
  getFeaturesByMinTier,
  tierGte,
} from './features-catalog'

describe('FEATURES_CATALOG', () => {
  it('contient exactement les 12 features V1 attendues', () => {
    expect(FEATURES_CATALOG).toHaveLength(12)
    const ids = FEATURES_CATALOG.map((f) => f.id).sort()
    const expected: FeatureId[] = [
      'voice_capture',
      'photo_geolocation',
      'cross_check_6_sources',
      'liciel_export',
      'devis',
      'factures',
      'annuaire',
      'parrainage',
      'analytics',
      'baseline_minutes',
      'integrations_pdp',
      'mission_chat',
    ]
    expect(ids).toEqual(expected.sort())
  })

  it('toutes les features ont un id unique', () => {
    const ids = FEATURES_CATALOG.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('toutes les features ont un posthog_event_name unique préfixé feature_used_', () => {
    for (const f of FEATURES_CATALOG) {
      expect(f.posthog_event_name).toMatch(/^feature_used_/)
    }
    const events = FEATURES_CATALOG.map((f) => f.posthog_event_name)
    expect(new Set(events).size).toBe(events.length)
  })

  it('expected_adoption_pct est borné 0-100 pour chaque feature', () => {
    for (const f of FEATURES_CATALOG) {
      expect(f.expected_adoption_pct).toBeGreaterThanOrEqual(0)
      expect(f.expected_adoption_pct).toBeLessThanOrEqual(100)
    }
  })

  it('min_usage_for_active >= 1 pour chaque feature', () => {
    for (const f of FEATURES_CATALOG) {
      expect(f.min_usage_for_active).toBeGreaterThanOrEqual(1)
    }
  })

  it('voice_capture est core, adoption 80%, min usage 3, tier solo', () => {
    const f = getFeature('voice_capture')
    expect(f).toBeDefined()
    expect(f?.impact).toBe('core')
    expect(f?.expected_adoption_pct).toBe(80)
    expect(f?.min_usage_for_active).toBe(3)
    expect(f?.available_from_tier).toBe('solo')
  })

  it('cross_check_6_sources est core, adoption 70%, min usage 5, tier solo', () => {
    const f = getFeature('cross_check_6_sources')
    expect(f?.impact).toBe('core')
    expect(f?.expected_adoption_pct).toBe(70)
    expect(f?.min_usage_for_active).toBe(5)
    expect(f?.available_from_tier).toBe('solo')
  })

  it('analytics est medium, adoption 30%, min usage 1, tier pro', () => {
    const f = getFeature('analytics')
    expect(f?.impact).toBe('medium')
    expect(f?.expected_adoption_pct).toBe(30)
    expect(f?.available_from_tier).toBe('pro')
  })

  it('integrations_pdp est low, adoption 15%, tier pro', () => {
    const f = getFeature('integrations_pdp')
    expect(f?.impact).toBe('low')
    expect(f?.expected_adoption_pct).toBe(15)
    expect(f?.available_from_tier).toBe('pro')
  })
})

describe('getFeature', () => {
  it('retourne la feature pour un id valide', () => {
    const f = getFeature('voice_capture')
    expect(f?.id).toBe('voice_capture')
  })

  it('retourne undefined pour un id inconnu (cast pour ne pas casser le test TS)', () => {
    const f = getFeature('unknown' as FeatureId)
    expect(f).toBeUndefined()
  })
})

describe('getFeaturesByCategory', () => {
  it('retourne les 4 features mission_workflow (voice + photo + cross_check + mission_chat)', () => {
    const list = getFeaturesByCategory('mission_workflow')
    const ids = list.map((f) => f.id).sort()
    expect(ids).toEqual(
      ['cross_check_6_sources', 'mission_chat', 'photo_geolocation', 'voice_capture'].sort(),
    )
  })

  it('retourne les 3 features business_ops (devis + factures + integrations_pdp)', () => {
    const list = getFeaturesByCategory('business_ops')
    const ids = list.map((f) => f.id).sort()
    expect(ids).toEqual(['devis', 'factures', 'integrations_pdp'].sort())
  })

  it('retourne les 2 features marketing (annuaire + parrainage)', () => {
    const list = getFeaturesByCategory('marketing')
    expect(list).toHaveLength(2)
  })

  it('retourne les 2 features analytics (analytics + baseline_minutes)', () => {
    const list = getFeaturesByCategory('analytics')
    expect(list).toHaveLength(2)
  })

  it('retourne 1 feature post_mission (liciel_export)', () => {
    const list = getFeaturesByCategory('post_mission')
    expect(list).toHaveLength(1)
    expect(list[0]?.id).toBe('liciel_export')
  })
})

describe('getFeaturesByMinTier', () => {
  it("'solo' ne retourne que les features available_from_tier='solo'", () => {
    const list = getFeaturesByMinTier('solo')
    for (const f of list) {
      expect(f.available_from_tier).toBe('solo')
    }
  })

  it("'pro' inclut solo + pro (analytics, integrations_pdp accessibles)", () => {
    const list = getFeaturesByMinTier('pro')
    const ids = list.map((f) => f.id)
    expect(ids).toContain('voice_capture') // solo
    expect(ids).toContain('analytics') // pro
    expect(ids).toContain('integrations_pdp') // pro
  })

  it("'cabinet_plus' inclut TOUTES les features", () => {
    const list = getFeaturesByMinTier('cabinet_plus')
    expect(list).toHaveLength(FEATURES_CATALOG.length)
  })
})

describe('tierGte', () => {
  it('cabinet_plus >= solo', () => {
    expect(tierGte('cabinet_plus', 'solo')).toBe(true)
  })

  it('pro >= pro (égalité)', () => {
    expect(tierGte('pro', 'pro')).toBe(true)
  })

  it('solo < pro (false)', () => {
    expect(tierGte('solo', 'pro')).toBe(false)
  })

  it('cabinet >= pro', () => {
    expect(tierGte('cabinet', 'pro')).toBe(true)
  })
})
