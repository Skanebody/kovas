import { describe, expect, it } from 'vitest'
import type { ActionPlan, AutoAction } from './action-decider'
import {
  INTERVENTION_TEMPLATES,
  buildInterventionPlan,
  getInterventionTemplate,
} from './intervention-templates'

const ALL_ACTIONS: ReadonlyArray<AutoAction> = [
  'send_founder_personal_email',
  'offer_call_15min',
  'pause_marketing_emails',
  'alert_benjamin_slack',
  'send_helpful_tip_email',
  'offer_onboarding_help',
  'suggest_underused_feature',
  'suggest_addon',
  'send_monthly_recap_email',
  'request_review',
  'request_referral',
  'invite_to_case_study',
]

// Regex anti-emoji : autorise lettres FR + ASCII commun + ponctuation usuelle + curly quote.
// On bannit toute pictographie hors ASCII (sauf accents FR + tirets cadratin/insécables).
const ALLOWED_NON_ASCII = /[àâäçéèêëîïôöùûüÿœÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŸŒ’«»—–·]/u

function hasEmoji(s: string): boolean {
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0
    if (code < 128) continue
    if (ALLOWED_NON_ASCII.test(ch)) continue
    // {{template}} merge tag tolérés mais code ASCII donc déjà passés.
    return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Registry coverage
// ---------------------------------------------------------------------------

describe('INTERVENTION_TEMPLATES — registry coverage', () => {
  it('définit un template pour chacune des 12 AutoAction', () => {
    for (const action of ALL_ACTIONS) {
      const tpl = INTERVENTION_TEMPLATES[action]
      expect(tpl).toBeDefined()
      expect(tpl.brevo_template_id_hint.length).toBeGreaterThan(0)
      expect(tpl.subject_variants.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('getInterventionTemplate retourne le template pour chaque action', () => {
    for (const action of ALL_ACTIONS) {
      expect(getInterventionTemplate(action)).toBeDefined()
    }
  })

  it('tone est dans la whitelist', () => {
    for (const action of ALL_ACTIONS) {
      const tpl = INTERVENTION_TEMPLATES[action]
      expect(['humain', 'transactionnel', 'pro_sober']).toContain(tpl.tone)
    }
  })

  it('cooldown_days est positif', () => {
    for (const action of ALL_ACTIONS) {
      const tpl = INTERVENTION_TEMPLATES[action]
      expect(tpl.cooldown_days).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// Contraintes subject_variants
// ---------------------------------------------------------------------------

describe('INTERVENTION_TEMPLATES — subject_variants respectent les contraintes copy', () => {
  it('aucun subject ne dépasse 50 caractères', () => {
    for (const action of ALL_ACTIONS) {
      const tpl = INTERVENTION_TEMPLATES[action]
      for (const subject of tpl.subject_variants) {
        expect(subject.length, `${action}: "${subject}"`).toBeLessThanOrEqual(50)
      }
    }
  })

  it("aucun subject ne contient d'emoji", () => {
    for (const action of ALL_ACTIONS) {
      const tpl = INTERVENTION_TEMPLATES[action]
      for (const subject of tpl.subject_variants) {
        expect(hasEmoji(subject), `${action}: "${subject}"`).toBe(false)
      }
    }
  })

  it("aucun subject ne contient 'vous' (tutoiement avatar)", () => {
    // On accepte 'tu', 'ton', 'ta', 'tes', etc. On vérifie qu'aucun "vous" isolé n'apparaît.
    const vouvoiementRe = /\b(vous|votre|vos)\b/i
    for (const action of ALL_ACTIONS) {
      const tpl = INTERVENTION_TEMPLATES[action]
      for (const subject of tpl.subject_variants) {
        expect(vouvoiementRe.test(subject), `${action}: "${subject}"`).toBe(false)
      }
    }
  })

  it("subjects sont uniques au sein d'un template", () => {
    for (const action of ALL_ACTIONS) {
      const tpl = INTERVENTION_TEMPLATES[action]
      const uniq = new Set(tpl.subject_variants)
      expect(uniq.size).toBe(tpl.subject_variants.length)
    }
  })
})

// ---------------------------------------------------------------------------
// Subjects spécifiques (smoke checks pour les principaux)
// ---------------------------------------------------------------------------

describe('INTERVENTION_TEMPLATES — subjects métier signature', () => {
  it('send_founder_personal_email contient un subject avec {{firstname}}', () => {
    const tpl = INTERVENTION_TEMPLATES.send_founder_personal_email
    const hasFirstnameTag = tpl.subject_variants.some((s) => s.includes('{{firstname}}'))
    expect(hasFirstnameTag).toBe(true)
  })

  it('request_referral mentionne parrainage ou collègue', () => {
    const tpl = INTERVENTION_TEMPLATES.request_referral
    const hit = tpl.subject_variants.some((s) => /coll[èe]gue|parrain/i.test(s))
    expect(hit).toBe(true)
  })

  it("send_helpful_tip_email parle d'astuces, temps gagné ou Liciel", () => {
    const tpl = INTERVENTION_TEMPLATES.send_helpful_tip_email
    const hit = tpl.subject_variants.some((s) =>
      /(astuce|min|gagn|truc|Liciel|terrain|fonction)/i.test(s),
    )
    expect(hit).toBe(true)
  })

  it('alert_benjamin_slack utilise un brevo_template_id_hint interne', () => {
    const tpl = INTERVENTION_TEMPLATES.alert_benjamin_slack
    expect(tpl.brevo_template_id_hint).toContain('internal')
  })

  it('send_founder_personal_email a un ton humain', () => {
    expect(INTERVENTION_TEMPLATES.send_founder_personal_email.tone).toBe('humain')
  })
})

// ---------------------------------------------------------------------------
// buildInterventionPlan
// ---------------------------------------------------------------------------

const userData = {
  firstname: 'Benjamin',
  tenure_months: 6,
  missions_total: 142,
  current_tier: 'pro',
}

function makePlan(primary: AutoAction, secondary: ReadonlyArray<AutoAction> = []): ActionPlan {
  return {
    bucket: 'healthy',
    primary_action: primary,
    secondary_actions: secondary,
    human_explanation: 'mock',
  }
}

describe('buildInterventionPlan', () => {
  it('retourne primary + template + dynamic_params remplis pour un user healthy', () => {
    const plan = makePlan('send_monthly_recap_email')
    const intervention = buildInterventionPlan(plan, userData)
    expect(intervention.primary).not.toBeNull()
    expect(intervention.primary?.action).toBe('send_monthly_recap_email')
    expect(intervention.primary?.template.brevo_template_id_hint).toBe('tx-cs-monthly-recap')
    expect(intervention.primary?.dynamic_params.firstname).toBe('Benjamin')
  })

  it('résout missions_this_month depuis user_data.missions_total', () => {
    const plan = makePlan('send_monthly_recap_email')
    const intervention = buildInterventionPlan(plan, userData)
    expect(intervention.primary?.dynamic_params.missions_this_month).toBe(142)
  })

  it('résout tenure_months', () => {
    const plan = makePlan('send_founder_personal_email')
    const intervention = buildInterventionPlan(plan, userData)
    expect(intervention.primary?.dynamic_params.tenure_months).toBe(6)
  })

  it('laisse les params non-user (calendly_url, etc.) en chaîne vide', () => {
    const plan = makePlan('offer_call_15min')
    const intervention = buildInterventionPlan(plan, userData)
    expect(intervention.primary?.dynamic_params.calendly_url).toBe('')
    expect(intervention.primary?.dynamic_params.firstname).toBe('Benjamin')
  })

  it('construit aussi secondary avec template + params', () => {
    const plan = makePlan('send_founder_personal_email', [
      'offer_call_15min',
      'alert_benjamin_slack',
    ])
    const intervention = buildInterventionPlan(plan, userData)
    expect(intervention.secondary).toHaveLength(2)
    expect(intervention.secondary[0]?.action).toBe('offer_call_15min')
    expect(intervention.secondary[1]?.action).toBe('alert_benjamin_slack')
    expect(intervention.secondary[1]?.dynamic_params.firstname).toBe('Benjamin')
    expect(intervention.secondary[1]?.dynamic_params.current_tier).toBe('pro')
  })

  it('toutes les actions ont un template valide quand utilisées via buildInterventionPlan', () => {
    for (const action of ALL_ACTIONS) {
      const intervention = buildInterventionPlan(makePlan(action), userData)
      expect(intervention.primary).not.toBeNull()
      expect(intervention.primary?.template).toBeDefined()
    }
  })

  it('dynamic_params contient toutes les clés requises par le template', () => {
    for (const action of ALL_ACTIONS) {
      const intervention = buildInterventionPlan(makePlan(action), userData)
      const template = intervention.primary?.template
      const params = intervention.primary?.dynamic_params ?? {}
      if (!template) continue
      for (const key of template.dynamic_params_required) {
        expect(Object.hasOwn(params, key), `${action} → missing ${key}`).toBe(true)
      }
    }
  })
})
