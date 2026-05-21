'use server'

/**
 * KOVAS — Server actions du module Relances (P7).
 *
 * - createFollowUpSequenceAction : crée une séquence de relance pour un devis/facture/mission,
 *   selon un preset (standard / soft / insistant). Respecte la migration `follow_up_sequences`
 *   (target_entity_type/target_entity_id, sequence_template, status='active', current_step=0,
 *   next_action_at calculé, context jsonb stockant les steps).
 *
 * Idempotence : refuse la création si une séquence active existe déjà pour la même cible.
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import {
  DEFAULT_SEQUENCES,
  type SequenceStep,
} from '@/lib/followup/executor'
import type { SequenceTemplate } from '@/lib/followup/templates'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ============================================
// Schéma validation
// ============================================

const TARGET_TYPES = ['quote', 'invoice', 'mission'] as const
const PRESETS = ['standard', 'soft', 'insistant'] as const

const createInputSchema = z.object({
  targetType: z.enum(TARGET_TYPES),
  targetId: z.string().uuid(),
  preset: z.enum(PRESETS).default('standard'),
})

export type CreateFollowUpInput = z.infer<typeof createInputSchema>

export interface CreateFollowUpResult {
  success: boolean
  sequenceId?: string
  nextActionAt?: string | null
  error?: string
}

// ============================================
// Mapping preset → steps (en jours)
// ============================================

/**
 * Renvoie les steps custom selon le preset choisi par l'utilisateur.
 * Les valeurs `delayDays` sont relatives au step précédent (sauf step 0 = depuis création).
 */
function buildSteps(targetType: (typeof TARGET_TYPES)[number], preset: (typeof PRESETS)[number]): {
  steps: SequenceStep[]
  template: SequenceTemplate
} {
  const template: SequenceTemplate =
    targetType === 'quote'
      ? 'quote_pending'
      : targetType === 'invoice'
        ? 'invoice_unpaid'
        : 'post_dpe_fg'

  // Presets par cible — délais EXPRIMÉS RELATIVEMENT AU STEP PRÉCÉDENT
  // (semantique conforme à executor.ts > computeNextActionAt).
  const PRESETS_MAP: Record<
    (typeof TARGET_TYPES)[number],
    Record<(typeof PRESETS)[number], SequenceStep[]>
  > = {
    quote: {
      standard: [
        { delayDays: 7, channel: 'email' },
        { delayDays: 7, channel: 'email' },
        { delayDays: 7, channel: 'email' },
      ],
      soft: [
        { delayDays: 10, channel: 'email' },
        { delayDays: 10, channel: 'email' },
        { delayDays: 10, channel: 'email' },
      ],
      insistant: [
        { delayDays: 3, channel: 'email' },
        { delayDays: 4, channel: 'email' },
        { delayDays: 7, channel: 'email' },
      ],
    },
    invoice: {
      standard: [
        { delayDays: 7, channel: 'email' },
        { delayDays: 8, channel: 'email' },
        { delayDays: 15, channel: 'email' },
      ],
      soft: [
        { delayDays: 10, channel: 'email' },
        { delayDays: 10, channel: 'email' },
        { delayDays: 10, channel: 'email' },
      ],
      insistant: [
        { delayDays: 3, channel: 'email' },
        { delayDays: 4, channel: 'email' },
        { delayDays: 7, channel: 'email' },
      ],
    },
    mission: {
      standard: DEFAULT_SEQUENCES.post_dpe_fg,
      soft: [
        { delayDays: 21, channel: 'email' },
        { delayDays: 69, channel: 'email' },
      ],
      insistant: [
        { delayDays: 7, channel: 'email' },
        { delayDays: 14, channel: 'email' },
        { delayDays: 30, channel: 'email' },
      ],
    },
  }

  return { steps: PRESETS_MAP[targetType][preset], template }
}

/**
 * Calcule la date du premier envoi (`next_action_at`) à partir de la création.
 * Garantit le minimum anti-spam (24h via MIN_DELAY_HOURS dans executor.ts).
 */
function computeFirstActionAt(steps: SequenceStep[]): string {
  const firstDelayDays = steps[0]?.delayDays ?? 7
  const ms = Math.max(firstDelayDays * 24 * 3_600_000, 24 * 3_600_000)
  return new Date(Date.now() + ms).toISOString()
}

// ============================================
// Server action
// ============================================

export async function createFollowUpSequenceAction(
  input: CreateFollowUpInput,
): Promise<CreateFollowUpResult> {
  const parsed = createInputSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') }
  }
  const { targetType, targetId, preset } = parsed.data

  let userId: string
  let orgId: string
  let supabase: Awaited<ReturnType<typeof getCurrentUser>>['supabase']
  try {
    const u = await getCurrentUser()
    userId = u.user.id
    orgId = u.orgId
    supabase = u.supabase
  } catch {
    return { success: false, error: 'Non authentifié.' }
  }

  // Idempotence : refuse si séquence déjà active/paused pour ce target.
  const { data: existing } = await supabase
    .from('follow_up_sequences' as never)
    .select('id, status')
    .eq('organization_id', orgId)
    .eq('target_entity_type', targetType)
    .eq('target_entity_id', targetId)
    .in('status', ['active', 'paused'])
    .limit(1)
  if (existing && existing.length > 0) {
    return {
      success: false,
      error: 'Une séquence est déjà active pour cette cible. Annulez-la avant d\'en créer une nouvelle.',
    }
  }

  // Vérifie que la cible existe et appartient à l'org (RLS gère, mais on remonte une erreur claire).
  const targetTable = targetType === 'mission' ? 'missions' : targetType === 'invoice' ? 'invoices' : 'quotes'
  const { data: targetRow, error: targetErr } = await supabase
    .from(targetTable)
    .select('id')
    .eq('id', targetId)
    .eq('organization_id', orgId)
    .maybeSingle()
  if (targetErr || !targetRow) {
    return { success: false, error: 'Cible introuvable ou non autorisée.' }
  }

  const { steps, template } = buildSteps(targetType, preset)
  const nextActionAt = computeFirstActionAt(steps)

  // Insertion — schéma migration `follow_up_sequences` (20260525152000).
  // Note : on stocke aussi `kind` et autres colonnes étendues si elles existent dans l'API legacy ;
  // les colonnes inconnues seront ignorées par Supabase si la table n'est pas étendue.
  const insertPayload: Record<string, unknown> = {
    organization_id: orgId,
    user_id: userId,
    target_entity_type: targetType,
    target_entity_id: targetId,
    sequence_template: template,
    current_step: 0,
    total_steps: steps.length,
    channel: 'email',
    status: 'active',
    next_action_at: nextActionAt,
    context: {
      steps,
      preset,
      created_via: 'manual_ui_p7',
    },
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('follow_up_sequences' as never)
    .insert(insertPayload as never)
    .select('id')
    .single()

  if (insertErr || !inserted) {
    return { success: false, error: insertErr?.message ?? 'Insertion impossible.' }
  }

  // Audit log (best-effort, non bloquant)
  try {
    await supabase.from('audit_log' as never).insert({
      organization_id: orgId,
      user_id: userId,
      action: 'followup_sequence.created',
      resource_type: 'followup_sequence',
      resource_id: (inserted as { id: string }).id,
      metadata: { target_type: targetType, target_id: targetId, preset, template },
    } as never)
  } catch {
    // Silencieux : audit non critique.
  }

  revalidatePath('/dashboard/relances')
  if (targetType === 'quote') revalidatePath(`/dashboard/devis/${targetId}`)
  if (targetType === 'invoice') revalidatePath(`/dashboard/factures/${targetId}`)
  if (targetType === 'mission') revalidatePath(`/dashboard/dossiers/${targetId}`)

  return {
    success: true,
    sequenceId: (inserted as { id: string }).id,
    nextActionAt,
  }
}

/**
 * Vérifie s'il existe déjà une séquence active/paused pour une cible donnée.
 * Utilisé par les pages détail devis/facture pour afficher ou non le CTA "Créer".
 */
export async function hasActiveFollowUpSequenceAction(
  targetType: (typeof TARGET_TYPES)[number],
  targetId: string,
): Promise<{ exists: boolean; sequenceId?: string }> {
  try {
    const { orgId, supabase } = await getCurrentUser()
    const { data } = await supabase
      .from('follow_up_sequences' as never)
      .select('id')
      .eq('organization_id', orgId)
      .eq('target_entity_type', targetType)
      .eq('target_entity_id', targetId)
      .in('status', ['active', 'paused'])
      .limit(1)
    if (data && data.length > 0) {
      return { exists: true, sequenceId: (data[0] as { id: string }).id }
    }
    return { exists: false }
  } catch {
    return { exists: false }
  }
}
