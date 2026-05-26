/**
 * Tests — séquence email Tugan TUGAN-4 (8 emails essai 30 jours, block switching).
 *
 * Couvre :
 *   - structure de la séquence (longueur, codes uniques, ordre par dayOffset)
 *   - présence des blocks rédactionnels signature (au moins 3 par email)
 *   - signature uniforme `— Benjamin` dans chaque body
 *   - rendu (`renderTuganEmail`) : substitution correcte + erreur si placeholder manquant
 *   - garde-fous spécifiques (tutoiement, absence de mentions provider IA tiers,
 *     block urgence présent uniquement sur J+21 et J+28)
 */

import { describe, expect, it } from 'vitest'

import { TUGAN_TRIAL_EMAILS, type TuganEmailCode, renderTuganEmail } from '../tugan-trial-sequence'

const EXPECTED_ORDER: readonly TuganEmailCode[] = [
  'j0',
  'j1',
  'j3',
  'j7',
  'j14',
  'j21',
  'j28',
  'j30',
]

const EXPECTED_DAY_OFFSETS: Readonly<Record<TuganEmailCode, number>> = {
  j0: 0,
  j1: 1,
  j3: 3,
  j7: 7,
  j14: 14,
  j21: 21,
  j28: 28,
  j30: 30,
}

describe('TUGAN_TRIAL_EMAILS — structure de la séquence', () => {
  it('contient exactement 8 emails', () => {
    expect(TUGAN_TRIAL_EMAILS).toHaveLength(8)
  })

  it("expose les 8 codes attendus dans l'ordre, sans doublon", () => {
    const codes = TUGAN_TRIAL_EMAILS.map((e) => e.code)
    expect(codes).toEqual(EXPECTED_ORDER)
    // Sanity : aucun doublon (Set conserve l'unicité)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('aligne dayOffset sur le code (j7 → 7, j21 → 21, etc.) et trie strictement croissant', () => {
    for (const tpl of TUGAN_TRIAL_EMAILS) {
      expect(tpl.dayOffset).toBe(EXPECTED_DAY_OFFSETS[tpl.code])
    }
    const offsets = TUGAN_TRIAL_EMAILS.map((e) => e.dayOffset)
    const sorted = [...offsets].sort((a, b) => a - b)
    expect(offsets).toEqual(sorted)
  })
})

describe('TUGAN_TRIAL_EMAILS — règles rédactionnelles par template', () => {
  it.each(TUGAN_TRIAL_EMAILS)('email $code contient au moins 3 blocks différents', (tpl) => {
    const blockRegex = /\[BLOCK [A-Z ÉÈ]+\]/g
    const matches = tpl.body.match(blockRegex) ?? []
    const uniqueBlocks = new Set(matches)
    expect(uniqueBlocks.size).toBeGreaterThanOrEqual(3)
  })

  it.each(TUGAN_TRIAL_EMAILS)('email $code se termine par la signature "— Benjamin"', (tpl) => {
    expect(tpl.body).toContain('— Benjamin')
    expect(tpl.body).toContain('benjamin@kovas.fr')
  })

  it.each(TUGAN_TRIAL_EMAILS)(
    'email $code utilise tutoiement (mots "tu", "ton", "tes" présents, "vous"/"votre" absents)',
    (tpl) => {
      const body = tpl.body.toLowerCase()
      // Présence d'au moins une marque de tutoiement (mot "tu" / "ton" / "tes" en frontière de mot)
      expect(/\b(tu|ton|tes|t'|toi)\b/.test(body)).toBe(true)
      // Pas de "vous" / "votre" / "vos" en frontière de mot dans le corps narratif.
      // (les variables interpolées restent libres — on teste le template brut)
      expect(/\b(vous|votre|vos)\b/.test(body)).toBe(false)
    },
  )

  it.each(TUGAN_TRIAL_EMAILS)(
    'email $code ne mentionne aucun provider IA tiers (directive transversale)',
    (tpl) => {
      const forbidden = [
        'claude',
        'anthropic',
        'whisper',
        'openai',
        'chatgpt',
        'gpt-4',
        'gpt-3',
        'gpt-5',
      ]
      const lower = `${tpl.subject}\n${tpl.body}`.toLowerCase()
      for (const term of forbidden) {
        expect(lower).not.toContain(term)
      }
    },
  )

  it("block URGENCE n'apparaît que sur les emails J+21 et J+28", () => {
    for (const tpl of TUGAN_TRIAL_EMAILS) {
      const hasUrgenceBlock = tpl.body.includes('[BLOCK URGENCE]')
      if (tpl.code === 'j21' || tpl.code === 'j28' || tpl.code === 'j30') {
        // J+21 et J+28 = obligatoire ; J+30 = optionnel (P.S. webinar)
        if (tpl.code === 'j21' || tpl.code === 'j28') {
          expect(hasUrgenceBlock).toBe(true)
        }
      } else {
        expect(hasUrgenceBlock).toBe(false)
      }
    }
  })

  it.each(TUGAN_TRIAL_EMAILS)('email $code expose un seul block CTA', (tpl) => {
    const ctaMatches = tpl.body.match(/\[BLOCK CTA\]/g) ?? []
    // Les emails à conversion (j0, j1, j3, j7, j14, j21, j28, j30) ont tous un CTA.
    // On accepte 1 ou plus (le J+30 a 3 CTAs explicites sous un seul block).
    expect(ctaMatches.length).toBeGreaterThanOrEqual(1)
    expect(ctaMatches.length).toBeLessThanOrEqual(1)
  })
})

describe('renderTuganEmail — substitution de placeholders', () => {
  it('remplace tous les placeholders {{first_name}} par la valeur fournie', () => {
    const tpl = TUGAN_TRIAL_EMAILS.find((e) => e.code === 'j0')
    if (!tpl) throw new Error('Template j0 introuvable')

    const result = renderTuganEmail(tpl, { first_name: 'Marc' })

    expect(result.body).toContain('Salut Marc,')
    expect(result.body).not.toContain('{{first_name}}')
    expect(result.subject).toBe(tpl.subject) // pas de placeholder dans le subject de j0
  })

  it('substitue plusieurs placeholders simultanément (J+7 cas multi-vars)', () => {
    const tpl = TUGAN_TRIAL_EMAILS.find((e) => e.code === 'j7')
    if (!tpl) throw new Error('Template j7 introuvable')

    const result = renderTuganEmail(tpl, {
      first_name: 'Sophie',
      missions_count: 18,
      hours_saved: '11h 24min',
      conformity_score: '94 %',
    })

    expect(result.body).toContain('Sophie')
    expect(result.body).toContain('18')
    expect(result.body).toContain('11h 24min')
    expect(result.body).toContain('94 %')
    expect(result.body).not.toMatch(/\{\{[a-z_]+\}\}/)
  })

  it('lève une erreur explicite si un placeholder déclaré est manquant', () => {
    const tpl = TUGAN_TRIAL_EMAILS.find((e) => e.code === 'j7')
    if (!tpl) throw new Error('Template j7 introuvable')

    // first_name manquant — doit throw
    expect(() =>
      renderTuganEmail(tpl, {
        missions_count: 12,
        hours_saved: '5h',
        conformity_score: '88 %',
      }),
    ).toThrowError(/Placeholder manquant.*first_name/)
  })

  it('lève une erreur si un placeholder déclaré vaut une chaîne vide', () => {
    const tpl = TUGAN_TRIAL_EMAILS.find((e) => e.code === 'j0')
    if (!tpl) throw new Error('Template j0 introuvable')

    expect(() => renderTuganEmail(tpl, { first_name: '' })).toThrowError(
      /Placeholder manquant.*first_name/,
    )
  })

  it('échappe correctement les regex spéciaux dans les noms de placeholder', () => {
    // Sanity check sur l'helper escapeRegex interne — on appelle render avec
    // un placeholder dont le nom contient des caractères regex-sensibles via
    // une var supplémentaire (qui ne match aucun pattern dans le body).
    const tpl = TUGAN_TRIAL_EMAILS.find((e) => e.code === 'j3')
    if (!tpl) throw new Error('Template j3 introuvable')

    const result = renderTuganEmail(tpl, {
      first_name: 'Pierre',
      // var bonus qui n'est pas dans le body — ne doit ni planter, ni polluer
      'unrelated.var$with*regex': 'ignored',
    })

    expect(result.body).toContain('Pierre,')
    expect(result.body).not.toContain('{{first_name}}')
  })
})
