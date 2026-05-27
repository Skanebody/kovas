import { describe, expect, it } from 'vitest'
import {
  type RawClaudeImpactResponse,
  buildAnalysisPrompt,
  parseClaudeImpactResponse,
} from './analyze-changes'
import type { SnapshotDiff } from './snapshot-diff'

function makeDiff(overrides: Partial<SnapshotDiff> = {}): SnapshotDiff {
  return {
    competitor_slug: 'liciel',
    url: 'https://www.liciel.com',
    previous_fetched_at: '2026-05-26T08:00:00.000Z',
    current_fetched_at: '2026-05-27T08:00:00.000Z',
    has_changes: true,
    is_significant: true,
    changes: [
      {
        type: 'price_added',
        before: null,
        after: 19,
        severity: 'strategic',
        detail: 'Nouveau prix détecté : 19€',
      },
    ],
    summary: 'Liciel : 1 changement(s) significatif(s) (Nouveau prix détecté : 19€)',
    ...overrides,
  }
}

describe('buildAnalysisPrompt', () => {
  it('inclut le contexte KOVAS (pricing 29/79/199/499)', () => {
    const prompt = buildAnalysisPrompt(makeDiff())
    expect(prompt).toContain('KOVAS')
    expect(prompt).toContain('29€')
    expect(prompt).toContain('79€')
    expect(prompt).toContain('199€')
    expect(prompt).toContain('499€')
  })

  it('inclut le nom du concurrent et sa PdM', () => {
    const prompt = buildAnalysisPrompt(makeDiff({ competitor_slug: 'liciel' }))
    expect(prompt).toContain('Liciel')
    expect(prompt).toContain('46% PdM')
  })

  it('inclut la mention "Menace stratégique majeure" pour Liciel', () => {
    const prompt = buildAnalysisPrompt(makeDiff({ competitor_slug: 'liciel' }))
    expect(prompt).toContain('Menace stratégique majeure')
  })

  it('inclut "Concurrent secondaire" pour AnalysImmo', () => {
    const prompt = buildAnalysisPrompt(makeDiff({ competitor_slug: 'analysimmo' }))
    expect(prompt).toContain('Concurrent secondaire')
  })

  it('inclut tous les changements détectés avec leur severity', () => {
    const diff = makeDiff({
      changes: [
        {
          type: 'price_added',
          before: null,
          after: 19,
          severity: 'strategic',
          detail: 'Nouveau prix détecté : 19€',
        },
        {
          type: 'h2_added',
          before: null,
          after: 'IA conversationnelle',
          severity: 'minor',
          detail: 'Nouveau H2 : "IA conversationnelle"',
        },
      ],
    })
    const prompt = buildAnalysisPrompt(diff)
    expect(prompt).toContain('STRATEGIC')
    expect(prompt).toContain('MINOR')
    expect(prompt).toContain('Nouveau prix détecté : 19€')
    expect(prompt).toContain('IA conversationnelle')
  })

  it('demande un format JSON strict avec les 4 champs', () => {
    const prompt = buildAnalysisPrompt(makeDiff())
    expect(prompt).toContain('"summary"')
    expect(prompt).toContain('"impact"')
    expect(prompt).toContain('"actions"')
    expect(prompt).toContain('"areas"')
    expect(prompt).toContain('STRICTEMENT')
  })

  it('inclut les timestamps previous/current', () => {
    const prompt = buildAnalysisPrompt(makeDiff())
    expect(prompt).toContain('2026-05-26T08:00:00.000Z')
    expect(prompt).toContain('2026-05-27T08:00:00.000Z')
  })

  it('inclut le résumé extracteur', () => {
    const prompt = buildAnalysisPrompt(makeDiff({ summary: 'Liciel : aucun changement' }))
    expect(prompt).toContain('Liciel : aucun changement')
  })

  it('gère le cas changes vide en affichant un placeholder', () => {
    const prompt = buildAnalysisPrompt(makeDiff({ changes: [] }))
    expect(prompt).toContain('aucun changement structuré')
  })

  it('inclut les 5 areas valides dans les instructions', () => {
    const prompt = buildAnalysisPrompt(makeDiff())
    expect(prompt).toContain('pricing')
    expect(prompt).toContain('features')
    expect(prompt).toContain('positioning')
    expect(prompt).toContain('marketing')
    expect(prompt).toContain('product')
  })
})

describe('parseClaudeImpactResponse — happy path', () => {
  it('parse une réponse valide', () => {
    const raw: RawClaudeImpactResponse = {
      summary: 'Liciel baisse son prix entrée à 19€/mo, attaque frontale sur Solo KOVAS.',
      impact: 'high',
      actions: [
        'Réviser pricing Solo 29€ → 25€ test',
        'Comm défensive blog : ROI mobile',
        'Pousser bundle Démarrage 39€',
      ],
      areas: ['pricing', 'marketing'],
    }
    const parsed = parseClaudeImpactResponse(raw)
    expect(parsed.summary).toContain('Liciel baisse')
    expect(parsed.impact_on_kovas).toBe('high')
    expect(parsed.recommended_actions).toHaveLength(3)
    expect(parsed.affected_areas).toEqual(['pricing', 'marketing'])
  })

  it('accepte impact = low / medium / high', () => {
    for (const impact of ['low', 'medium', 'high'] as const) {
      const parsed = parseClaudeImpactResponse({
        summary: 'x',
        impact,
        actions: [],
        areas: [],
      })
      expect(parsed.impact_on_kovas).toBe(impact)
    }
  })
})

describe('parseClaudeImpactResponse — validation et normalisation', () => {
  it("fallback impact='low' si valeur invalide", () => {
    const parsed = parseClaudeImpactResponse({
      summary: 'x',
      impact: 'critical',
      actions: [],
      areas: [],
    })
    expect(parsed.impact_on_kovas).toBe('low')
  })

  it('normalise impact en minuscules', () => {
    const parsed = parseClaudeImpactResponse({
      summary: 'x',
      impact: 'HIGH',
      actions: [],
      areas: [],
    })
    expect(parsed.impact_on_kovas).toBe('high')
  })

  it('plafonne recommended_actions à 3', () => {
    const parsed = parseClaudeImpactResponse({
      summary: 'x',
      impact: 'medium',
      actions: ['a', 'b', 'c', 'd', 'e'],
      areas: [],
    })
    expect(parsed.recommended_actions).toHaveLength(3)
    expect(parsed.recommended_actions).toEqual(['a', 'b', 'c'])
  })

  it('filtre les actions > 200 chars', () => {
    const longAction = 'x'.repeat(250)
    const parsed = parseClaudeImpactResponse({
      summary: 'x',
      impact: 'medium',
      actions: ['valide', longAction, 'aussi valide'],
      areas: [],
    })
    expect(parsed.recommended_actions).toEqual(['valide', 'aussi valide'])
  })

  it('filtre les actions vides ou whitespace-only', () => {
    const parsed = parseClaudeImpactResponse({
      summary: 'x',
      impact: 'medium',
      actions: ['valide', '   ', ''],
      areas: [],
    })
    expect(parsed.recommended_actions).toEqual(['valide'])
  })

  it('filtre les areas invalides', () => {
    const parsed = parseClaudeImpactResponse({
      summary: 'x',
      impact: 'medium',
      actions: [],
      areas: ['pricing', 'invalid', 'product', 'foo'],
    })
    expect(parsed.affected_areas).toEqual(['pricing', 'product'])
  })

  it('dédoublonne les areas', () => {
    const parsed = parseClaudeImpactResponse({
      summary: 'x',
      impact: 'medium',
      actions: [],
      areas: ['pricing', 'pricing', 'features'],
    })
    expect(parsed.affected_areas).toEqual(['pricing', 'features'])
  })

  it('normalise areas en lowercase', () => {
    const parsed = parseClaudeImpactResponse({
      summary: 'x',
      impact: 'medium',
      actions: [],
      areas: ['PRICING', 'Features'],
    })
    expect(parsed.affected_areas).toEqual(['pricing', 'features'])
  })

  it('plafonne summary à 500 chars', () => {
    const longSummary = 'x'.repeat(800)
    const parsed = parseClaudeImpactResponse({
      summary: longSummary,
      impact: 'low',
      actions: [],
      areas: [],
    })
    expect(parsed.summary.length).toBeLessThanOrEqual(500)
  })

  it('gère gracieusement les inputs null/undefined dans les sous-champs', () => {
    const parsed = parseClaudeImpactResponse({
      // @ts-expect-error — test runtime robustesse
      summary: null,
      // @ts-expect-error — test runtime robustesse
      impact: null,
      // @ts-expect-error — test runtime robustesse
      actions: null,
      // @ts-expect-error — test runtime robustesse
      areas: null,
    })
    expect(parsed.summary).toBe('')
    expect(parsed.impact_on_kovas).toBe('low')
    expect(parsed.recommended_actions).toEqual([])
    expect(parsed.affected_areas).toEqual([])
  })

  it('ignore les actions non-string', () => {
    const parsed = parseClaudeImpactResponse({
      summary: 'x',
      impact: 'medium',
      // @ts-expect-error — test runtime robustesse
      actions: ['valide', 42, null, 'ok'],
      areas: [],
    })
    expect(parsed.recommended_actions).toEqual(['valide', 'ok'])
  })
})
