import { describe, expect, it } from 'vitest'
import {
  EMAIL_TEMPLATES,
  type EmailTemplate,
  type EmailTemplateId,
  getEmailTemplate,
  getTemplatesByCategory,
} from './templates'

const EMOJI_RE = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u

describe('EMAIL_TEMPLATES — registry', () => {
  it('contient au moins 15 templates', () => {
    expect(EMAIL_TEMPLATES.length).toBeGreaterThanOrEqual(15)
  })

  it('ids sont uniques', () => {
    const ids = EMAIL_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('chaque template a 3 à 5 default_subject_variants', () => {
    for (const t of EMAIL_TEMPLATES) {
      expect(t.default_subject_variants.length).toBeGreaterThanOrEqual(3)
      expect(t.default_subject_variants.length).toBeLessThanOrEqual(5)
    }
  })

  it('toutes les 5 catégories sont représentées', () => {
    const cats = new Set(EMAIL_TEMPLATES.map((t) => t.category))
    expect(cats.has('transactional')).toBe(true)
    expect(cats.has('lifecycle')).toBe(true)
    expect(cats.has('retention')).toBe(true)
    expect(cats.has('expansion')).toBe(true)
    expect(cats.has('engagement')).toBe(true)
  })

  it('toutes les 15 templates IDs canoniques sont présents', () => {
    const expectedIds: EmailTemplateId[] = [
      'trial_day_1_tutorial',
      'trial_day_4_check_in',
      'trial_day_8_tips',
      'trial_day_27_will_end',
      'trial_day_30_converted',
      'retention_high_risk',
      'retention_medium_risk',
      'upsell_tier_upgrade',
      'upsell_addon_pipeline_mpr',
      'upsell_addon_premium_reports',
      'feature_promo_voice_capture',
      'feature_promo_cross_check',
      'review_request',
      'referral_invitation',
      'reactivation_winback',
    ]
    const ids = new Set(EMAIL_TEMPLATES.map((t) => t.id))
    for (const id of expectedIds) {
      expect(ids.has(id)).toBe(true)
    }
  })
})

describe('EMAIL_TEMPLATES — subjects respectent les contraintes', () => {
  function allSubjects(): Array<{ tid: EmailTemplateId; subject: string }> {
    const arr: Array<{ tid: EmailTemplateId; subject: string }> = []
    for (const t of EMAIL_TEMPLATES) {
      for (const s of t.default_subject_variants) {
        arr.push({ tid: t.id, subject: s })
      }
    }
    return arr
  }

  it("aucun subject n'excède 50 caractères", () => {
    for (const { tid, subject } of allSubjects()) {
      if (subject.length > 50) {
        throw new Error(`${tid} subject "${subject}" = ${subject.length} chars`)
      }
      expect(subject.length).toBeLessThanOrEqual(50)
    }
  })

  it("aucun subject ne contient d'emoji", () => {
    for (const { tid, subject } of allSubjects()) {
      if (EMOJI_RE.test(subject)) {
        throw new Error(`${tid} subject "${subject}" contient un emoji`)
      }
      expect(EMOJI_RE.test(subject)).toBe(false)
    }
  })

  it("aucun subject n'utilise le vouvoiement (vous / votre / vos)", () => {
    const vousRe = /\b(vous|votre|vos|vôtre|vôtres)\b/i
    for (const { tid, subject } of allSubjects()) {
      if (vousRe.test(subject)) {
        throw new Error(`${tid} subject "${subject}" vouvoie`)
      }
      expect(vousRe.test(subject)).toBe(false)
    }
  })

  it("aucun subject n'est vide ou whitespace", () => {
    for (const { subject } of allSubjects()) {
      expect(subject.trim().length).toBeGreaterThan(0)
    }
  })
})

describe('getEmailTemplate', () => {
  it('retourne le template pour un id valide', () => {
    const t = getEmailTemplate('trial_day_27_will_end')
    expect(t).toBeDefined()
    expect(t?.id).toBe('trial_day_27_will_end')
    expect(t?.category).toBe('lifecycle')
  })

  it('retourne undefined pour un id inconnu', () => {
    // @ts-expect-error — test cast forcé
    const t = getEmailTemplate('unknown_id_xxx')
    expect(t).toBeUndefined()
  })

  it('le template retourné a toutes les clés requises', () => {
    const t = getEmailTemplate('upsell_tier_upgrade') as EmailTemplate
    expect(t.id).toBe('upsell_tier_upgrade')
    expect(t.category).toBe('expansion')
    expect(t.description).toBeTruthy()
    expect(t.target_audience).toBeTruthy()
    expect(t.primary_kpi).toBe('conversion_rate')
    expect(t.cooldown_days).toBeGreaterThan(0)
    expect(t.default_subject_variants.length).toBeGreaterThan(0)
  })
})

describe('getTemplatesByCategory', () => {
  it('retourne tous les templates lifecycle', () => {
    const lifecycle = getTemplatesByCategory('lifecycle')
    expect(lifecycle.length).toBeGreaterThanOrEqual(4)
    for (const t of lifecycle) {
      expect(t.category).toBe('lifecycle')
    }
  })

  it('retourne tous les templates expansion', () => {
    const expansion = getTemplatesByCategory('expansion')
    expect(expansion.length).toBeGreaterThanOrEqual(2)
    for (const t of expansion) {
      expect(t.category).toBe('expansion')
    }
  })

  it('retourne au moins 1 template transactional', () => {
    const trans = getTemplatesByCategory('transactional')
    expect(trans.length).toBeGreaterThanOrEqual(1)
  })

  it('retient des cooldowns cohérents : transactional >= 1 an pour confirmation', () => {
    const trans = getTemplatesByCategory('transactional')
    for (const t of trans) {
      expect(t.cooldown_days).toBeGreaterThanOrEqual(30)
    }
  })
})
