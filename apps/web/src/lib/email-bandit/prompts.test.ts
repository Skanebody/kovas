import { describe, expect, it } from 'vitest'
import {
  type RawClaudeSubjectsResponse,
  SYSTEM_PROMPT,
  buildSubjectGenerationPrompt,
  parseAndFilterSubjects,
} from './prompts'

const EMOJI_RE = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u

describe('SYSTEM_PROMPT', () => {
  it('impose le tutoiement', () => {
    expect(SYSTEM_PROMPT).toMatch(/tutoiement/i)
    expect(SYSTEM_PROMPT).toMatch(/Vouvoiement INTERDIT/i)
  })

  it("impose pas d'emoji", () => {
    expect(SYSTEM_PROMPT).toMatch(/aucun emoji/i)
  })

  it('impose max 50 caractères', () => {
    expect(SYSTEM_PROMPT).toMatch(/50 caractères/i)
  })

  it('mentionne les 5 méthodes Tugan Bara', () => {
    expect(SYSTEM_PROMPT).toMatch(/Specificity/i)
    expect(SYSTEM_PROMPT).toMatch(/Loss aversion/i)
    expect(SYSTEM_PROMPT).toMatch(/Curiosity gap/i)
    expect(SYSTEM_PROMPT).toMatch(/Contraste/i)
    expect(SYSTEM_PROMPT).toMatch(/Language match/i)
  })

  it('impose format JSON strict', () => {
    expect(SYSTEM_PROMPT).toMatch(/JSON strict/i)
    expect(SYSTEM_PROMPT).toContain('"subjects"')
  })
})

describe('buildSubjectGenerationPrompt — contenu', () => {
  it('inclut le template_id et la description', () => {
    const prompt = buildSubjectGenerationPrompt({
      template_id: 'trial_day_27_will_end',
      template_description: 'J+27 essai termine dans 3 jours.',
      target_audience: 'Diagnostiqueurs J+27',
      primary_kpi: 'conversion_rate',
      top_winners: [
        { content: 'Ton essai termine dans 3 jours', open_rate: 0.42 },
        { content: 'On débite ta carte le 30', open_rate: 0.38 },
      ],
    })
    expect(prompt).toContain('trial_day_27_will_end')
    expect(prompt).toContain('J+27 essai termine dans 3 jours.')
    expect(prompt).toContain('Diagnostiqueurs J+27')
  })

  it('liste les top_winners avec leur open_rate en pourcentage', () => {
    const prompt = buildSubjectGenerationPrompt({
      template_id: 'upsell_tier_upgrade',
      template_description: 'Upsell tier',
      target_audience: 'Solo overconsumers',
      primary_kpi: 'conversion_rate',
      top_winners: [{ content: 'Ton quota mensuel touche au plafond', open_rate: 0.45 }],
    })
    expect(prompt).toContain('Ton quota mensuel touche au plafond')
    expect(prompt).toContain('45.0%')
  })

  it('gère le cas top_winners vide (cold start)', () => {
    const prompt = buildSubjectGenerationPrompt({
      template_id: 'review_request',
      template_description: 'Demande avis post D60',
      target_audience: 'Abonnés D60+',
      primary_kpi: 'click_rate',
      top_winners: [],
    })
    expect(prompt).toMatch(/Aucun winner actuel/i)
  })

  it('traduit le KPI en français lisible', () => {
    const prompt = buildSubjectGenerationPrompt({
      template_id: 'feature_promo_voice_capture',
      template_description: 'Promo voice',
      target_audience: 'No-voice users',
      primary_kpi: 'open_rate',
      top_winners: [],
    })
    expect(prompt).toMatch(/taux d'ouverture/i)
  })

  it('rappelle les contraintes tutoiement + no emoji + 50 chars', () => {
    const prompt = buildSubjectGenerationPrompt({
      template_id: 'trial_day_1_tutorial',
      template_description: 'J+1 tuto',
      target_audience: 'J+1',
      primary_kpi: 'click_rate',
      top_winners: [],
    })
    expect(prompt).toMatch(/[Tt]utoiement/)
    expect(prompt).toMatch(/[Ee]moji/)
    expect(prompt).toMatch(/50 caractères/)
  })
})

describe('parseAndFilterSubjects — filtres', () => {
  it('retourne max 5 subjects', () => {
    const raw: RawClaudeSubjectsResponse = {
      subjects: ['Un', 'Deux', 'Trois', 'Quatre', 'Cinq', 'Six', 'Sept'],
    }
    const out = parseAndFilterSubjects(raw, 'trial_day_1_tutorial')
    expect(out.length).toBe(5)
  })

  it('filtre les subjects > 50 caractères', () => {
    const tooLong = 'x'.repeat(51)
    const ok = 'Bon subject court'
    const out = parseAndFilterSubjects({ subjects: [tooLong, ok] }, 'trial_day_1_tutorial')
    expect(out).toEqual([ok])
  })

  it('filtre les subjects vides ou whitespace', () => {
    const out = parseAndFilterSubjects(
      { subjects: ['', '   ', 'Bon subject'] },
      'trial_day_1_tutorial',
    )
    expect(out).toEqual(['Bon subject'])
  })

  it('filtre les subjects contenant des emojis', () => {
    const out = parseAndFilterSubjects(
      {
        subjects: [
          'Bon subject simple',
          'Subject avec emoji 🚀',
          'Autre clean',
          'Avec ⭐ étoile',
          'Avec 🎉 fête',
        ],
      },
      'trial_day_1_tutorial',
    )
    expect(out).toEqual(['Bon subject simple', 'Autre clean'])
    for (const s of out) {
      expect(EMOJI_RE.test(s)).toBe(false)
    }
  })

  it("convertit 'vous' → 'tu' (cas simple)", () => {
    const out = parseAndFilterSubjects(
      { subjects: ['Vous payez trop cher'] },
      'trial_day_27_will_end',
    )
    expect(out[0]).toBe('tu payez trop cher')
  })

  it("convertit 'vous êtes' → 'tu es' (conjugaison accentuée)", () => {
    const out = parseAndFilterSubjects(
      { subjects: ['Vous êtes en retard'] },
      'trial_day_27_will_end',
    )
    expect(out[0]).toBe('tu es en retard')
  })

  it("convertit 'vous avez' → 'tu as'", () => {
    const out = parseAndFilterSubjects({ subjects: ['Vous avez 3 jours'] }, 'trial_day_27_will_end')
    expect(out[0]).toBe('tu as 3 jours')
  })

  it("convertit 'votre' → 'ton'", () => {
    const out = parseAndFilterSubjects(
      { subjects: ['Votre essai termine'] },
      'trial_day_27_will_end',
    )
    expect(out[0]).toBe('ton essai termine')
  })

  it("convertit 'vos' → 'tes'", () => {
    const out = parseAndFilterSubjects(
      { subjects: ['Vos diagnostics du mois'] },
      'feature_promo_cross_check',
    )
    expect(out[0]).toBe('tes diagnostics du mois')
  })

  it('préserve les subjects déjà en tutoiement', () => {
    const out = parseAndFilterSubjects(
      { subjects: ['Ton essai termine dans 3 jours'] },
      'trial_day_27_will_end',
    )
    expect(out[0]).toBe('Ton essai termine dans 3 jours')
  })

  it('trime les whitespaces externes', () => {
    const out = parseAndFilterSubjects(
      { subjects: ['  Subject avec spaces  '] },
      'trial_day_1_tutorial',
    )
    expect(out[0]).toBe('Subject avec spaces')
  })

  it('input invalide → array vide', () => {
    // @ts-expect-error — test schema invalide
    expect(parseAndFilterSubjects({ subjects: null }, 'trial_day_1_tutorial')).toEqual([])
    // @ts-expect-error — test schema invalide
    expect(parseAndFilterSubjects({}, 'trial_day_1_tutorial')).toEqual([])
    // @ts-expect-error — test schema invalide
    expect(parseAndFilterSubjects(null, 'trial_day_1_tutorial')).toEqual([])
  })

  it('filtre les non-strings dans subjects[]', () => {
    const out = parseAndFilterSubjects(
      // @ts-expect-error — test schema mixte
      { subjects: [123, 'Bon subject', null, true, 'Autre'] },
      'trial_day_1_tutorial',
    )
    expect(out).toEqual(['Bon subject', 'Autre'])
  })

  it('garde exactement 50 chars (borne inclusive)', () => {
    const fifty = 'x'.repeat(50)
    const out = parseAndFilterSubjects({ subjects: [fifty] }, 'trial_day_1_tutorial')
    expect(out).toEqual([fifty])
  })
})
