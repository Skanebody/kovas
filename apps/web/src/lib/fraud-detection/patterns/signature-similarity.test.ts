import { describe, expect, it } from 'vitest'
import {
  cosineSimilarity,
  detectSignatureSimilarity,
  normalizeForSimilarity,
  wordNgrams,
} from './signature-similarity'

describe('normalizeForSimilarity', () => {
  it('lowercases, strips accents and punctuation', () => {
    expect(normalizeForSimilarity('Étanchéité, isolation : OK.')).toBe('etancheite isolation ok')
  })
})

describe('wordNgrams', () => {
  it('produces 3-grams from a 5-word sentence', () => {
    expect(wordNgrams('un deux trois quatre cinq', 3)).toEqual([
      'un deux trois',
      'deux trois quatre',
      'trois quatre cinq',
    ])
  })

  it('falls back to the full phrase if shorter than n', () => {
    expect(wordNgrams('court', 3)).toEqual(['court'])
  })
})

describe('cosineSimilarity', () => {
  it('returns 1 for identical token bags', () => {
    expect(cosineSimilarity(['a', 'b'], ['a', 'b'])).toBeCloseTo(1, 5)
  })

  it('returns 0 for disjoint bags', () => {
    expect(cosineSimilarity(['a'], ['b'])).toBe(0)
  })
})

describe('detectSignatureSimilarity', () => {
  it('flags near-identical comments between two different operators', () => {
    const text =
      'Visite réalisée le 22 mai, accès aux combles confirmé, isolation correcte, chaudière gaz récente identifiée et fonctionnelle.'
    const signal = detectSignatureSimilarity({
      candidate: { scanId: 'sc1', diagnosticianId: 'diag-A', comments: text },
      others: [{ scanId: 'sc2', diagnosticianId: 'diag-B', comments: text }],
    })
    expect(signal.flagged).toBe(true)
    expect(signal.severity).toBeGreaterThanOrEqual(0.8)
  })

  it('does not flag distinct comments', () => {
    const signal = detectSignatureSimilarity({
      candidate: {
        scanId: 'sc1',
        diagnosticianId: 'diag-A',
        comments:
          'Maison de 1990, ravalement de façade récent, isolation par l extérieur en bon état.',
      },
      others: [
        {
          scanId: 'sc2',
          diagnosticianId: 'diag-B',
          comments:
            'Appartement T3 au 2e étage, chauffage individuel électrique, fenêtres double vitrage 2015.',
        },
      ],
    })
    expect(signal.flagged).toBe(false)
    expect(signal.severity).toBeLessThan(0.3)
  })

  it('skips comparison with same operator', () => {
    const text = 'Texte commun bla bla bla — visite OK confirmée.'
    const signal = detectSignatureSimilarity({
      candidate: { scanId: 'sc1', diagnosticianId: 'diag-A', comments: text },
      others: [{ scanId: 'sc2', diagnosticianId: 'diag-A', comments: text }],
    })
    expect(signal.flagged).toBe(false)
  })
})
