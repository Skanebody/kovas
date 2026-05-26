/**
 * Tests — system prompt Premium Client Report (Upsell #1 Tugan v3.0, 19 €/mo).
 *
 * Couvre :
 *   - signature et type de retour (string non vide)
 *   - audience cible mentionnée explicitement (propriétaire) pour éviter le
 *     drift vers un ton ADEME / certificateur
 *   - vouvoiement obligatoire (le propriétaire n'est pas tutoyé, contrairement
 *     à l'avatar diagnostiqueur côté app KOVAS)
 *   - injection des paramètres mission (adresse, surface, etc.) si fournis
 *   - mention MaPrimeRénov' conditionnelle sur DPE F/G
 *   - dégradation propre si contexte vide (instruction "à confirmer" plutôt
 *     qu'invention de chiffres)
 *   - absence de mentions de fournisseur IA tiers (directive transversale 2026-05)
 */

import { describe, expect, it } from 'vitest'

import { buildPremiumReportSystemPrompt } from '../premium-report'

describe('buildPremiumReportSystemPrompt', () => {
  it('retourne un string non vide sans contexte', () => {
    const prompt = buildPremiumReportSystemPrompt()
    expect(typeof prompt).toBe('string')
    expect(prompt.length).toBeGreaterThan(500)
  })

  it('mentionne explicitement le propriétaire comme audience cible', () => {
    const prompt = buildPremiumReportSystemPrompt()
    expect(prompt).toMatch(/propriétaire/i)
  })

  it('exige le vouvoiement et interdit le tutoiement', () => {
    const prompt = buildPremiumReportSystemPrompt()
    expect(prompt).toMatch(/vouvoiement/i)
    expect(prompt).toMatch(/tutoiement.*interdit/i)
  })

  it('injecte les paramètres mission fournis dans le bloc contexte', () => {
    const prompt = buildPremiumReportSystemPrompt({
      missionReference: 'MIS-2026-00042',
      ownerName: 'M. et Mme Martin',
      propertyAddress: '12 rue de la Paix, 76200 Dieppe',
      surfaceM2: 87.5,
      constructionYear: 1962,
      missionType: 'dpe_vente',
    })

    expect(prompt).toContain('MIS-2026-00042')
    expect(prompt).toContain('M. et Mme Martin')
    expect(prompt).toContain('12 rue de la Paix, 76200 Dieppe')
    expect(prompt).toContain('87.5 m²')
    expect(prompt).toContain('1962')
    expect(prompt).toContain('Diagnostic de Performance Énergétique (vente)')
  })

  it("injecte la mention MaPrimeRénov' obligatoire quand DPE = F", () => {
    const prompt = buildPremiumReportSystemPrompt({ dpeLetter: 'F' })
    expect(prompt).toMatch(/MaPrimeRénov/i)
    expect(prompt).toMatch(/passoire énergétique/i)
    expect(prompt).toMatch(/MENTIONNER explicitement/i)
  })

  it("injecte la mention MaPrimeRénov' obligatoire quand DPE = G", () => {
    const prompt = buildPremiumReportSystemPrompt({ dpeLetter: 'G' })
    expect(prompt).toMatch(/MaPrimeRénov/i)
    expect(prompt).toMatch(/passoire énergétique/i)
  })

  it("garde une mention MaPrimeRénov' factuelle quand DPE = C (pas de obligation)", () => {
    const prompt = buildPremiumReportSystemPrompt({ dpeLetter: 'C' })
    // Le bloc DPE F/G n'apparaît pas, mais le bloc neutre OUI.
    expect(prompt).not.toMatch(/passoire énergétique/i)
    expect(prompt).toMatch(/opérateur agréé/i)
  })

  it('dégrade proprement si aucun contexte fourni (instruction "à confirmer")', () => {
    const prompt = buildPremiumReportSystemPrompt({})
    expect(prompt).toMatch(/aucune donnée contextuelle/i)
    expect(prompt).toMatch(/à confirmer/i)
  })

  it('exige un retour JSON strict (sans markdown)', () => {
    const prompt = buildPremiumReportSystemPrompt()
    expect(prompt).toMatch(/JSON strict/i)
    expect(prompt).toMatch(/sans markdown/i)
    // Les 4 clés du schéma de sortie doivent être documentées.
    expect(prompt).toContain('"intro"')
    expect(prompt).toContain('"par_piece"')
    expect(prompt).toContain('"recommandations"')
    expect(prompt).toContain('"conclusion"')
  })

  it('exige des recommandations chiffrées (euros + payback)', () => {
    const prompt = buildPremiumReportSystemPrompt()
    expect(prompt).toMatch(/CHIFFRÉES/i)
    expect(prompt).toMatch(/euros/i)
    expect(prompt).toMatch(/payback/i)
  })

  it("interdit explicitement d'inventer des chiffres absents", () => {
    const prompt = buildPremiumReportSystemPrompt()
    expect(prompt).toMatch(/n'inventez JAMAIS un chiffre/i)
  })

  it('ne mentionne aucun fournisseur IA tiers (directive transversale 2026-05)', () => {
    const prompt = buildPremiumReportSystemPrompt({
      missionType: 'dpe_vente',
      diagnostiqueurName: 'Benjamin Bel',
    })
    // Liste noire des marques IA — aucune ne doit apparaître dans le prompt.
    expect(prompt).not.toMatch(/anthropic/i)
    expect(prompt).not.toMatch(/claude/i)
    expect(prompt).not.toMatch(/openai/i)
    expect(prompt).not.toMatch(/gpt-/i)
    expect(prompt).not.toMatch(/whisper/i)
    expect(prompt).not.toMatch(/gemini/i)
  })

  it('exige une signature finale avec le nom et la certification du diagnostiqueur', () => {
    const prompt = buildPremiumReportSystemPrompt({
      diagnostiqueurName: 'Benjamin Bel',
      diagnostiqueurCertNumber: 'CRTF-12345',
    })
    expect(prompt).toContain('Benjamin Bel')
    expect(prompt).toContain('CRTF-12345')
  })

  it('mappe correctement tous les types de mission supportés', () => {
    // Smoke test : aucun type ne doit produire un libellé "undefined" dans le prompt.
    const types = [
      'dpe_vente',
      'dpe_location',
      'amiante_vente',
      'amiante_avant_travaux',
      'plomb_crep',
      'gaz',
      'electricite',
      'termites',
      'carrez_boutin',
      'erp',
      'copropriete',
    ] as const

    for (const t of types) {
      const prompt = buildPremiumReportSystemPrompt({ missionType: t })
      expect(prompt).not.toMatch(/Type de diagnostic : undefined/i)
      expect(prompt).toMatch(/Type de diagnostic : /)
    }
  })
})
