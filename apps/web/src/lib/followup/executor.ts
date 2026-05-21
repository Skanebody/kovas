/**
 * KOVAS — Exécution d'une étape de séquence de relance (Module 5).
 *
 * Helpers Node réutilisables (Edge Function `follow-up-sequence-tick` + UI admin
 * de pré-visualisation). Pas d'I/O DB ici : c'est l'Edge Function qui charge le
 * contexte et appelle `sendEmail` / `sendSms`.
 *
 * Type `SequenceStep` reflète la structure JSONB stockée dans
 * `follow_up_sequences.context.steps[]`.
 *
 * Garde-fous :
 *  - max 4 steps par séquence (constante MAX_STEPS)
 *  - délai minimum entre 2 steps : 24 h (configurable via MIN_DELAY_HOURS)
 */

import type { SequenceTemplate, SequenceStepContent } from './templates'

export const MAX_STEPS_PER_SEQUENCE = 4
export const MIN_DELAY_HOURS = 24

export type SequenceChannel = 'email' | 'sms' | 'in_app' | 'task'

export interface SequenceStep {
  /** Délai depuis le step précédent (ou la création pour le step 0), en jours. */
  delayDays: number
  /** Canal de livraison. */
  channel: SequenceChannel
  /** Sous-template à utiliser (le template global est sur la séquence elle-même). */
  templateVariant?: string
  /** Surcharges manuelles (sujet libre, contenu libre — bypass templates). */
  manualSubject?: string
  manualBody?: string
}

export interface SequenceDefinition {
  template: SequenceTemplate
  steps: SequenceStep[]
  /** Contexte applicatif (quote_id, invoice_id, mission_id...). */
  targetEntityType: 'quote' | 'invoice' | 'mission' | 'auto_quote' | 'contact'
  targetEntityId: string
}

/**
 * Calcule la prochaine échéance à partir du step courant et de l'instant de référence.
 * Renvoie null si la séquence est terminée.
 */
export function computeNextActionAt(
  steps: SequenceStep[],
  newCurrentStep: number,
  fromIso: string,
): string | null {
  if (newCurrentStep >= steps.length) return null
  const step = steps[newCurrentStep]
  if (!step) return null
  const delayHours = Math.max(step.delayDays * 24, MIN_DELAY_HOURS)
  const from = new Date(fromIso)
  const next = new Date(from.getTime() + delayHours * 3_600_000)
  return next.toISOString()
}

/**
 * Valide une séquence à la création — refuse les invariants violés.
 * Lève une erreur explicative si le payload est invalide.
 */
export function validateSequenceDefinition(def: SequenceDefinition): void {
  if (def.steps.length === 0) {
    throw new Error('sequence must have at least 1 step')
  }
  if (def.steps.length > MAX_STEPS_PER_SEQUENCE) {
    throw new Error(`sequence cannot have more than ${MAX_STEPS_PER_SEQUENCE} steps`)
  }
  def.steps.forEach((step, i) => {
    if (typeof step.delayDays !== 'number' || step.delayDays < 0) {
      throw new Error(`step ${i}: delayDays must be a positive number`)
    }
    if (i === 0 && step.delayDays * 24 < MIN_DELAY_HOURS) {
      throw new Error(
        `step 0: delayDays must be ≥ ${MIN_DELAY_HOURS / 24} (anti-spam minimum)`,
      )
    }
  })
}

/**
 * Définit une "table de templates" par défaut pour chaque type de séquence.
 * Utilisée par l'UI de création de relance ("Activer la séquence standard").
 */
export const DEFAULT_SEQUENCES: Record<SequenceTemplate, SequenceStep[]> = {
  quote_pending: [
    { delayDays: 7, channel: 'email' },
    { delayDays: 8, channel: 'email' },
    { delayDays: 15, channel: 'email' },
  ],
  invoice_unpaid: [
    { delayDays: 7, channel: 'email' },
    { delayDays: 14, channel: 'email' },
    { delayDays: 15, channel: 'email' },
  ],
  post_dpe_fg: [
    { delayDays: 14, channel: 'email' },
    { delayDays: 76, channel: 'email' }, // J+90 total
  ],
  prescriber_silent: [{ delayDays: 60, channel: 'email' }],
  review_request: [{ delayDays: 3, channel: 'email' }],
}

/**
 * Résultat d'une exécution de step (retourné par l'exécutant).
 */
export interface StepExecutionResult {
  status: 'sent' | 'failed' | 'skipped_optout' | 'skipped_rate_limit'
  providerId?: string
  errorMessage?: string
  channelUsed: SequenceChannel
  recipientTo: string
}

/**
 * Choisit le sujet/contenu à envoyer pour un step donné, en respectant
 * d'éventuelles surcharges `manualSubject` / `manualBody`.
 */
export function resolveStepContent(
  step: SequenceStep,
  defaultContent: SequenceStepContent,
): SequenceStepContent {
  if (step.manualSubject && step.manualBody) {
    return {
      subject: step.manualSubject,
      text: step.manualBody,
      html: defaultContent.html, // garde le chrome HTML
    }
  }
  return defaultContent
}
