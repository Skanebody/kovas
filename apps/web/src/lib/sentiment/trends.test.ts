import { describe, expect, it } from 'vitest'
import type { SentimentAnalysisResult, Topic } from './analyzer'
import { aggregateByTopic, detectDegradation } from './trends'

function makeAnalysis(opts: {
  score: number
  topics: Topic[]
  urgency?: 'low' | 'medium' | 'high' | 'critical'
  phrases?: string[]
}): SentimentAnalysisResult {
  return {
    sentiment: 'neutral',
    sentiment_score: opts.score,
    topics: opts.topics,
    urgency: opts.urgency ?? 'low',
    intent: 'other',
    key_phrases: opts.phrases ?? [],
    triggers_retention: false,
    triggers_immediate_response: false,
    human_summary: '—',
  }
}

describe('aggregateByTopic', () => {
  it('agrège plusieurs analyses sur le même topic', () => {
    const analyses = [
      makeAnalysis({ score: -0.5, topics: ['voice_capture'] }),
      makeAnalysis({ score: -0.3, topics: ['voice_capture'] }),
      makeAnalysis({ score: 0.1, topics: ['voice_capture'] }),
    ]
    const result = aggregateByTopic(analyses)
    const voice = result.find((r) => r.topic === 'voice_capture')
    expect(voice).toBeDefined()
    expect(voice?.message_count).toBe(3)
    expect(voice?.avg_sentiment_score).toBeCloseTo((-0.5 - 0.3 + 0.1) / 3, 3)
  })

  it('compte 1 mention par topic même quand multi-topics par analyse', () => {
    const analyses = [
      makeAnalysis({ score: -0.5, topics: ['voice_capture', 'bug'] }),
      makeAnalysis({ score: -0.7, topics: ['bug'] }),
    ]
    const result = aggregateByTopic(analyses)
    expect(result.find((r) => r.topic === 'voice_capture')?.message_count).toBe(1)
    expect(result.find((r) => r.topic === 'bug')?.message_count).toBe(2)
  })

  it("agrège la distribution d'urgency", () => {
    const analyses = [
      makeAnalysis({ score: -0.5, topics: ['bug'], urgency: 'critical' }),
      makeAnalysis({ score: -0.5, topics: ['bug'], urgency: 'high' }),
      makeAnalysis({ score: -0.5, topics: ['bug'], urgency: 'high' }),
      makeAnalysis({ score: -0.5, topics: ['bug'], urgency: 'medium' }),
    ]
    const result = aggregateByTopic(analyses)
    const bug = result.find((r) => r.topic === 'bug')
    expect(bug?.urgency_distribution).toEqual({
      low: 0,
      medium: 1,
      high: 2,
      critical: 1,
    })
  })

  it('top_phrases triées par fréquence puis alpha', () => {
    const analyses = [
      makeAnalysis({ score: 0, topics: ['bug'], phrases: ['ne marche pas', 'crash'] }),
      makeAnalysis({ score: 0, topics: ['bug'], phrases: ['crash', 'erreur 500'] }),
      makeAnalysis({ score: 0, topics: ['bug'], phrases: ['crash'] }),
    ]
    const result = aggregateByTopic(analyses)
    const bug = result.find((r) => r.topic === 'bug')
    // 'crash' apparaît 3x, autres 1x
    expect(bug?.top_phrases[0]).toBe('crash')
  })

  it('limite top_phrases à 5', () => {
    const analyses = [
      makeAnalysis({
        score: 0,
        topics: ['bug'],
        phrases: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'],
      }),
    ]
    const result = aggregateByTopic(analyses)
    const bug = result.find((r) => r.topic === 'bug')
    expect(bug?.top_phrases).toHaveLength(5)
  })

  it('trie le résultat par message_count desc', () => {
    const analyses = [
      makeAnalysis({ score: 0, topics: ['pricing'] }),
      makeAnalysis({ score: 0, topics: ['bug'] }),
      makeAnalysis({ score: 0, topics: ['bug'] }),
      makeAnalysis({ score: 0, topics: ['bug'] }),
      makeAnalysis({ score: 0, topics: ['voice_capture'] }),
      makeAnalysis({ score: 0, topics: ['voice_capture'] }),
    ]
    const result = aggregateByTopic(analyses)
    expect(result[0]?.topic).toBe('bug')
    expect(result[1]?.topic).toBe('voice_capture')
    expect(result[2]?.topic).toBe('pricing')
  })

  it('retourne tableau vide si aucune analyse', () => {
    expect(aggregateByTopic([])).toEqual([])
  })

  it('phrase normalisée (lowercase + trim) pour le compte', () => {
    const analyses = [makeAnalysis({ score: 0, topics: ['bug'], phrases: ['Crash ', '  CRASH'] })]
    const result = aggregateByTopic(analyses)
    expect(result[0]?.top_phrases).toEqual(['crash'])
  })
})

describe('detectDegradation', () => {
  it('détecte severity=critical si delta ≤ -0.4', () => {
    // Current : 6 messages à -0.5 (avg -0.5)
    const current = Array.from({ length: 6 }, () =>
      makeAnalysis({ score: -0.5, topics: ['voice_capture'] }),
    )
    // Previous : 10 messages à 0.0 (avg 0.0)
    const previous = Array.from({ length: 10 }, () =>
      makeAnalysis({ score: 0, topics: ['voice_capture'] }),
    )
    const alerts = detectDegradation(current, previous)
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.severity).toBe('critical')
    expect(alerts[0]?.delta).toBeCloseTo(-0.5, 2)
    expect(alerts[0]?.topic).toBe('voice_capture')
  })

  it('détecte severity=warning si -0.4 < delta ≤ -0.2', () => {
    const current = Array.from({ length: 6 }, () =>
      makeAnalysis({ score: -0.25, topics: ['pricing'] }),
    )
    const previous = Array.from({ length: 10 }, () =>
      makeAnalysis({ score: 0, topics: ['pricing'] }),
    )
    const alerts = detectDegradation(current, previous)
    expect(alerts).toHaveLength(1)
    expect(alerts[0]?.severity).toBe('warning')
  })

  it('ignore les topics avec moins de 5 mentions dans current_window', () => {
    const current = [
      makeAnalysis({ score: -0.5, topics: ['voice_capture'] }),
      makeAnalysis({ score: -0.5, topics: ['voice_capture'] }),
      makeAnalysis({ score: -0.5, topics: ['voice_capture'] }),
      makeAnalysis({ score: -0.5, topics: ['voice_capture'] }),
    ]
    const previous = Array.from({ length: 10 }, () =>
      makeAnalysis({ score: 0, topics: ['voice_capture'] }),
    )
    const alerts = detectDegradation(current, previous)
    expect(alerts).toHaveLength(0)
  })

  it('ignore les topics sans historique dans previous_window', () => {
    const current = Array.from({ length: 6 }, () =>
      makeAnalysis({ score: -0.5, topics: ['ademe'] }),
    )
    const previous = Array.from({ length: 5 }, () =>
      makeAnalysis({ score: 0, topics: ['pricing'] }),
    )
    const alerts = detectDegradation(current, previous)
    expect(alerts).toHaveLength(0)
  })

  it("ne retourne pas d'alerte si delta > -0.2 (amélioration ou stable)", () => {
    const current = Array.from({ length: 6 }, () =>
      makeAnalysis({ score: 0.1, topics: ['pricing'] }),
    )
    const previous = Array.from({ length: 10 }, () =>
      makeAnalysis({ score: 0, topics: ['pricing'] }),
    )
    const alerts = detectDegradation(current, previous)
    expect(alerts).toHaveLength(0)
  })

  it('trie alerts par severity desc puis message_count desc', () => {
    // Topic A : -0.5 (critical, 6 mentions)
    const aCurrent = Array.from({ length: 6 }, () =>
      makeAnalysis({ score: -0.5, topics: ['voice_capture'] }),
    )
    // Topic B : -0.25 (warning, 10 mentions)
    const bCurrent = Array.from({ length: 10 }, () =>
      makeAnalysis({ score: -0.25, topics: ['pricing'] }),
    )
    // Topic C : -0.5 (critical, 8 mentions)
    const cCurrent = Array.from({ length: 8 }, () => makeAnalysis({ score: -0.5, topics: ['bug'] }))

    const previous = [
      ...Array.from({ length: 10 }, () => makeAnalysis({ score: 0, topics: ['voice_capture'] })),
      ...Array.from({ length: 10 }, () => makeAnalysis({ score: 0, topics: ['pricing'] })),
      ...Array.from({ length: 10 }, () => makeAnalysis({ score: 0, topics: ['bug'] })),
    ]

    const alerts = detectDegradation([...aCurrent, ...bCurrent, ...cCurrent], previous)
    expect(alerts).toHaveLength(3)
    // Critical first (bug: 8 mentions, voice_capture: 6 mentions)
    expect(alerts[0]?.severity).toBe('critical')
    expect(alerts[0]?.topic).toBe('bug')
    expect(alerts[1]?.severity).toBe('critical')
    expect(alerts[1]?.topic).toBe('voice_capture')
    expect(alerts[2]?.severity).toBe('warning')
    expect(alerts[2]?.topic).toBe('pricing')
  })

  it('human_message contient le label FR du topic et le delta', () => {
    const current = Array.from({ length: 6 }, () =>
      makeAnalysis({ score: -0.5, topics: ['voice_capture'] }),
    )
    const previous = Array.from({ length: 10 }, () =>
      makeAnalysis({ score: 0, topics: ['voice_capture'] }),
    )
    const alerts = detectDegradation(current, previous)
    expect(alerts[0]?.human_message).toContain('saisie vocale')
    expect(alerts[0]?.human_message).toContain('mentions')
    // delta -0.50 formatted
    expect(alerts[0]?.human_message).toMatch(/-0\.50/)
  })

  it('retourne tableau vide si fenêtres vides', () => {
    expect(detectDegradation([], [])).toEqual([])
  })
})
