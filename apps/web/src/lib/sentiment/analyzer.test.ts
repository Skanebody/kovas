import { describe, expect, it } from 'vitest'
import { type MessageContext, type RawClaudeAnalysis, analyzeSentiment } from './analyzer'

const baseRaw: RawClaudeAnalysis = {
  sentiment_score: 0,
  topics: [],
  urgency: 'low',
  intent: 'other',
  key_phrases: [],
}

const baseContext: MessageContext = {
  source: 'support_ticket',
}

describe('analyzeSentiment — sentiment buckets', () => {
  it('classe score -0.9 comme very_negative', () => {
    const result = analyzeSentiment(
      { ...baseRaw, sentiment_score: -0.9 },
      'message neutre',
      baseContext,
    )
    expect(result.sentiment).toBe('very_negative')
    expect(result.sentiment_score).toBe(-0.9)
  })

  it('classe score -0.4 comme negative', () => {
    const result = analyzeSentiment({ ...baseRaw, sentiment_score: -0.4 }, 'message', baseContext)
    expect(result.sentiment).toBe('negative')
  })

  it('classe score 0 comme neutral', () => {
    const result = analyzeSentiment(baseRaw, 'message', baseContext)
    expect(result.sentiment).toBe('neutral')
  })

  it('classe score 0.4 comme positive', () => {
    const result = analyzeSentiment({ ...baseRaw, sentiment_score: 0.4 }, 'message', baseContext)
    expect(result.sentiment).toBe('positive')
  })

  it('classe score 0.9 comme very_positive', () => {
    const result = analyzeSentiment({ ...baseRaw, sentiment_score: 0.9 }, 'message', baseContext)
    expect(result.sentiment).toBe('very_positive')
  })

  it('clamp score >1 à 1 (very_positive)', () => {
    const result = analyzeSentiment({ ...baseRaw, sentiment_score: 5 }, 'message', baseContext)
    expect(result.sentiment_score).toBe(1)
    expect(result.sentiment).toBe('very_positive')
  })

  it('clamp score <-1 à -1 (very_negative)', () => {
    const result = analyzeSentiment({ ...baseRaw, sentiment_score: -10 }, 'message', baseContext)
    expect(result.sentiment_score).toBe(-1)
    expect(result.sentiment).toBe('very_negative')
  })
})

describe('analyzeSentiment — topics mapping', () => {
  it('mappe topics bruts FR vers enum KOVAS', () => {
    const result = analyzeSentiment(
      { ...baseRaw, topics: ['prix', 'voix', 'liciel'] },
      'message',
      baseContext,
    )
    expect(result.topics).toEqual(['pricing', 'voice_capture', 'liciel_export'])
  })

  it('mappe topics EN vers enum KOVAS', () => {
    const result = analyzeSentiment(
      { ...baseRaw, topics: ['pricing', 'voice_capture', 'feature_request'] },
      'message',
      baseContext,
    )
    expect(result.topics).toEqual(['pricing', 'voice_capture', 'feature_request'])
  })

  it("fallback sur 'other' pour topic inconnu", () => {
    const result = analyzeSentiment(
      { ...baseRaw, topics: ['quelque-chose-inconnu'] },
      'message',
      baseContext,
    )
    expect(result.topics).toEqual(['other'])
  })

  it('limite à 3 topics max et dédoublonne', () => {
    const result = analyzeSentiment(
      {
        ...baseRaw,
        topics: ['pricing', 'prix', 'tarif', 'voix', 'liciel', 'ademe'],
      },
      'message',
      baseContext,
    )
    expect(result.topics.length).toBeLessThanOrEqual(3)
    // pricing, prix, tarif → tous mappés sur 'pricing', dédoublonnés
    expect(result.topics).toContain('pricing')
  })

  it('ignore les topics string vides', () => {
    const result = analyzeSentiment(
      { ...baseRaw, topics: ['', '   ', 'pricing'] },
      'message',
      baseContext,
    )
    expect(result.topics).toEqual(['pricing'])
  })
})

describe('analyzeSentiment — règle churn keywords', () => {
  it("force intent=churn_signal quand 'résilier' présent", () => {
    const result = analyzeSentiment(
      { ...baseRaw, intent: 'complaint', urgency: 'low' },
      "Je vais résilier mon abonnement, c'est trop cher.",
      baseContext,
    )
    expect(result.intent).toBe('churn_signal')
    expect(result.urgency === 'high' || result.urgency === 'critical').toBe(true)
  })

  it("force intent=churn_signal quand 'annuler' présent", () => {
    const result = analyzeSentiment(
      { ...baseRaw, intent: 'question' },
      'Comment annuler mon compte ?',
      baseContext,
    )
    expect(result.intent).toBe('churn_signal')
  })

  it("force intent=churn_signal quand 'concurrent' présent", () => {
    const result = analyzeSentiment(
      { ...baseRaw, intent: 'complaint' },
      'Je vais aller chez la concurrent.',
      baseContext,
    )
    expect(result.intent).toBe('churn_signal')
  })

  it("force intent=churn_signal quand 'liciel suffit' présent", () => {
    const result = analyzeSentiment(
      { ...baseRaw, intent: 'other' },
      'Franchement Liciel suffit pour moi, pas besoin de KOVAS.',
      baseContext,
    )
    expect(result.intent).toBe('churn_signal')
  })

  it('triggers_retention=true quand churn_signal détecté', () => {
    const result = analyzeSentiment({ ...baseRaw }, 'Je vais résilier.', baseContext)
    expect(result.triggers_retention).toBe(true)
  })
})

describe('analyzeSentiment — règle rating review', () => {
  it('rating 1 (review) force urgency=high + intent=complaint', () => {
    const result = analyzeSentiment(
      { ...baseRaw, intent: 'other', urgency: 'low' },
      'Service moyen.',
      { source: 'review', rating: 1 },
    )
    expect(result.intent).toBe('complaint')
    expect(result.urgency === 'high' || result.urgency === 'critical').toBe(true)
  })

  it('rating 2 (review) force urgency≥high', () => {
    const result = analyzeSentiment(
      { ...baseRaw, intent: 'suggestion', urgency: 'medium' },
      'Pas terrible.',
      { source: 'review', rating: 2 },
    )
    expect(result.urgency === 'high' || result.urgency === 'critical').toBe(true)
  })

  it("rating 5 (review) n'override pas l'intent ni l'urgency", () => {
    const result = analyzeSentiment({ ...baseRaw, intent: 'praise', urgency: 'low' }, 'Génial !', {
      source: 'review',
      rating: 5,
    })
    expect(result.intent).toBe('praise')
    expect(result.urgency).toBe('low')
  })

  it('rating ≤2 + churn signal → priorité churn_signal sur complaint', () => {
    const result = analyzeSentiment({ ...baseRaw, intent: 'complaint' }, 'Je vais résilier.', {
      source: 'review',
      rating: 1,
    })
    expect(result.intent).toBe('churn_signal')
  })

  it("rating sur source non-review n'override pas l'intent", () => {
    const result = analyzeSentiment({ ...baseRaw, intent: 'question' }, 'Bonjour.', {
      source: 'support_ticket',
      rating: 1,
    })
    expect(result.intent).toBe('question')
  })
})

describe('analyzeSentiment — règle bug keywords', () => {
  it("force topic 'bug' + urgency≥medium quand 'crash' présent", () => {
    const result = analyzeSentiment(
      { ...baseRaw, urgency: 'low', topics: ['voice_capture'] },
      "L'app crash quand je clique sur Sauvegarder.",
      baseContext,
    )
    expect(result.topics).toContain('bug')
    expect(['medium', 'high', 'critical']).toContain(result.urgency)
  })

  it("'erreur 500' déclenche topic bug", () => {
    const result = analyzeSentiment(
      { ...baseRaw },
      "J'ai une erreur 500 sur l'export PDF.",
      baseContext,
    )
    expect(result.topics).toContain('bug')
  })

  it("'marche pas' déclenche topic bug", () => {
    const result = analyzeSentiment(
      { ...baseRaw },
      'La saisie vocale marche pas du tout.',
      baseContext,
    )
    expect(result.topics).toContain('bug')
  })
})

describe('analyzeSentiment — règle tenure upgrade', () => {
  it('user fidèle (12 mois) + complaint → urgency upgrade low→medium', () => {
    const result = analyzeSentiment(
      { ...baseRaw, intent: 'complaint', urgency: 'low' },
      'Je ne suis pas satisfait.',
      { source: 'support_ticket', user_tenure_months: 14 },
    )
    expect(result.urgency).toBe('medium')
  })

  it('user fidèle + complaint medium → high', () => {
    const result = analyzeSentiment(
      { ...baseRaw, intent: 'complaint', urgency: 'medium' },
      'Bug récurrent depuis 2 semaines.',
      { source: 'support_ticket', user_tenure_months: 18 },
    )
    expect(result.urgency).toBe('high')
  })

  it("user récent (3 mois) + complaint n'upgrade PAS l'urgency", () => {
    const result = analyzeSentiment(
      { ...baseRaw, intent: 'complaint', urgency: 'low' },
      "Je n'aime pas la couleur.",
      { source: 'support_ticket', user_tenure_months: 3 },
    )
    expect(result.urgency).toBe('low')
  })

  it("user fidèle sans intent=complaint n'upgrade PAS", () => {
    const result = analyzeSentiment(
      { ...baseRaw, intent: 'question', urgency: 'low' },
      'Une question simple.',
      { source: 'support_ticket', user_tenure_months: 24 },
    )
    expect(result.urgency).toBe('low')
  })
})

describe('analyzeSentiment — flags actionnables', () => {
  it('triggers_immediate_response=true uniquement si urgency=critical', () => {
    const result = analyzeSentiment({ ...baseRaw, urgency: 'critical' }, 'message', baseContext)
    expect(result.triggers_immediate_response).toBe(true)
  })

  it('triggers_immediate_response=false pour urgency=high (pas critical)', () => {
    const result = analyzeSentiment({ ...baseRaw, urgency: 'high' }, 'message', baseContext)
    expect(result.triggers_immediate_response).toBe(false)
  })

  it('triggers_retention=true si urgency=critical (même sans churn)', () => {
    const result = analyzeSentiment(
      { ...baseRaw, urgency: 'critical', intent: 'complaint' },
      'message normal',
      baseContext,
    )
    expect(result.triggers_retention).toBe(true)
  })
})

describe('analyzeSentiment — human_summary', () => {
  it('format human_summary avec source · sentiment · intent · topic', () => {
    const result = analyzeSentiment(
      {
        sentiment_score: -0.8,
        topics: ['pricing'],
        urgency: 'high',
        intent: 'complaint',
        key_phrases: ['prix élevé'],
      },
      'Le prix est élevé pour ce que ça propose.',
      { source: 'review', rating: 2 },
    )
    expect(result.human_summary).toContain('Avis')
    expect(result.human_summary).toContain('très négatif')
    expect(result.human_summary).toContain('réclamation')
    expect(result.human_summary).toContain('pricing')
  })

  it("human_summary utilise 'autre' si aucun topic mappé", () => {
    const result = analyzeSentiment({ ...baseRaw, topics: [] }, 'message neutre', baseContext)
    expect(result.human_summary).toContain('autre')
  })
})

describe('analyzeSentiment — key_phrases', () => {
  it('limite key_phrases à 5 max', () => {
    const result = analyzeSentiment(
      {
        ...baseRaw,
        key_phrases: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
      },
      'message',
      baseContext,
    )
    expect(result.key_phrases).toHaveLength(5)
    expect(result.key_phrases).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('filtre les key_phrases vides', () => {
    const result = analyzeSentiment(
      { ...baseRaw, key_phrases: ['', '  ', 'phrase utile'] },
      'message',
      baseContext,
    )
    expect(result.key_phrases).toEqual(['phrase utile'])
  })
})

describe('analyzeSentiment — validation enums', () => {
  it("urgency invalide fallback sur 'low'", () => {
    const result = analyzeSentiment(
      { ...baseRaw, urgency: 'invalid_urgency_xyz' },
      'message',
      baseContext,
    )
    expect(result.urgency).toBe('low')
  })

  it("intent invalide fallback sur 'other'", () => {
    const result = analyzeSentiment(
      { ...baseRaw, intent: 'unknown_intent_zzz' },
      'message',
      baseContext,
    )
    expect(result.intent).toBe('other')
  })

  it('urgency=critical depuis raw préservé', () => {
    const result = analyzeSentiment(
      { ...baseRaw, urgency: 'critical' },
      'message bénin',
      baseContext,
    )
    expect(result.urgency).toBe('critical')
    expect(result.triggers_immediate_response).toBe(true)
  })
})
