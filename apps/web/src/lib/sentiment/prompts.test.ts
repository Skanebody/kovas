import { describe, expect, it } from 'vitest'
import { SYSTEM_PROMPT, buildSentimentPrompt } from './prompts'

describe('SYSTEM_PROMPT', () => {
  it('contient le contexte métier KOVAS (Liciel, ADEME, DPE)', () => {
    expect(SYSTEM_PROMPT).toContain('KOVAS')
    expect(SYSTEM_PROMPT).toContain('Liciel')
    expect(SYSTEM_PROMPT).toContain('ADEME')
    expect(SYSTEM_PROMPT).toContain('DPE')
  })

  it('spécifie le format JSON strict de sortie', () => {
    expect(SYSTEM_PROMPT).toContain('JSON')
    expect(SYSTEM_PROMPT).toContain('sentiment_score')
    expect(SYSTEM_PROMPT).toContain('topics')
    expect(SYSTEM_PROMPT).toContain('urgency')
    expect(SYSTEM_PROMPT).toContain('intent')
    expect(SYSTEM_PROMPT).toContain('key_phrases')
  })

  it("interdit le texte hors JSON ('RÉPONDS UNIQUEMENT EN JSON')", () => {
    expect(SYSTEM_PROMPT.toUpperCase()).toContain('UNIQUEMENT')
  })

  it('liste les 7 intents valides', () => {
    expect(SYSTEM_PROMPT).toContain('complaint')
    expect(SYSTEM_PROMPT).toContain('question')
    expect(SYSTEM_PROMPT).toContain('praise')
    expect(SYSTEM_PROMPT).toContain('suggestion')
    expect(SYSTEM_PROMPT).toContain('churn_signal')
    expect(SYSTEM_PROMPT).toContain('support_request')
  })
})

describe('buildSentimentPrompt', () => {
  it('inclut le message original entre marqueurs', () => {
    const prompt = buildSentimentPrompt('La saisie vocale est géniale.', {
      source: 'review',
      rating: 5,
    })
    expect(prompt).toContain('La saisie vocale est géniale.')
    expect(prompt).toContain('--- DÉBUT DU MESSAGE ---')
    expect(prompt).toContain('--- FIN DU MESSAGE ---')
  })

  it('indique la source pour un review', () => {
    const prompt = buildSentimentPrompt('msg', { source: 'review' })
    expect(prompt).toContain('Avis public')
  })

  it('indique la source pour un support_ticket', () => {
    const prompt = buildSentimentPrompt('msg', { source: 'support_ticket' })
    expect(prompt).toContain('Ticket support')
  })

  it('indique la source pour in_app_chat', () => {
    const prompt = buildSentimentPrompt('msg', { source: 'in_app_chat' })
    expect(prompt).toContain('chat in-app')
  })

  it('indique la source pour survey', () => {
    const prompt = buildSentimentPrompt('msg', { source: 'survey' })
    expect(prompt).toContain('sondage')
  })

  it('indique la source pour email_reply', () => {
    const prompt = buildSentimentPrompt('msg', { source: 'email_reply' })
    expect(prompt).toContain('email')
  })

  it('inclut le rating si fourni', () => {
    const prompt = buildSentimentPrompt('msg', { source: 'review', rating: 3 })
    expect(prompt).toContain('3/5')
  })

  it("n'inclut PAS la ligne rating si absent", () => {
    const prompt = buildSentimentPrompt('msg', { source: 'support_ticket' })
    expect(prompt).not.toMatch(/Note attribuée/)
  })

  it('inclut tenure si fourni', () => {
    const prompt = buildSentimentPrompt('msg', {
      source: 'support_ticket',
      user_tenure_months: 12,
    })
    expect(prompt).toContain('12 mois')
  })

  it("n'inclut PAS la ligne tenure si absent", () => {
    const prompt = buildSentimentPrompt('msg', { source: 'support_ticket' })
    expect(prompt).not.toMatch(/Ancienneté utilisateur/)
  })

  it('demande explicitement le JSON strict en fin de prompt', () => {
    const prompt = buildSentimentPrompt('msg', { source: 'support_ticket' })
    expect(prompt).toContain('JSON')
    expect(prompt).toContain('sentiment_score')
  })
})
