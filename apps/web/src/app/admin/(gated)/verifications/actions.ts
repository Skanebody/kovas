'use server'

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { revalidatePath } from 'next/cache'

/**
 * Server actions pour la modération des vérifications diagnostiqueurs.
 *
 * Toutes les actions ré-appellent verifyAdminAccess() pour empêcher tout
 * usage hors gate admin (defense in depth ; layout admin gated déjà appliqué).
 *
 * Audit : chaque action écrit une ligne dans verification_checks_log avec
 * triggered_by='admin:<uuid>' pour traçabilité.
 */

type VerificationPhase = 'identity' | 'cofrac' | 'rcpro' | 'sirene'

async function requireAdmin(): Promise<string> {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    throw new Error('Accès non autorisé')
  }
  return access.user.id
}

function pickStringField(formData: FormData, key: string): string | null {
  const v = formData.get(key)
  return typeof v === 'string' && v.length > 0 ? v : null
}

async function logCheck(opts: {
  diagId: string
  adminId: string
  checkType:
    | 'identity_initial'
    | 'cofrac_initial'
    | 'rcpro_initial'
    | 'sirene_initial'
    | 'manual_audit'
  status: 'success' | 'failure' | 'warning'
  result: Record<string, unknown>
}): Promise<void> {
  const supabase = createAdminClient()
  // verification_checks_log : table VAL-1 pas encore dans Database types
  // biome-ignore lint/suspicious/noExplicitAny: types regen pending
  await (supabase as any).from('verification_checks_log').insert({
    diagnostician_id: opts.diagId,
    check_type: opts.checkType,
    check_source: 'admin_manual',
    status: opts.status,
    duration_ms: 0,
    result: opts.result,
    triggered_by: `admin:${opts.adminId}`,
  })
}

/**
 * Approve toutes les phases d'un diagnostician en bloc (final review).
 * Met overall_status implicitement à 'verified' (column GENERATED) +
 * badge_level='verified'.
 */
export async function approveAllPhasesAction(formData: FormData): Promise<void> {
  const adminId = await requireAdmin()
  const diagId = pickStringField(formData, 'diagId')
  if (!diagId) throw new Error('diagId requis')

  const supabase = createAdminClient()
  const now = new Date().toISOString()
  // biome-ignore lint/suspicious/noExplicitAny: types regen pending pour table VAL-1
  const { error } = await (supabase as any)
    .from('diagnostician_verification_status')
    .update({
      identity_status: 'verified',
      cofrac_status: 'verified',
      rcpro_status: 'verified',
      sirene_status: 'verified',
      identity_verified_at: now,
      cofrac_verified_at: now,
      rcpro_verified_at: now,
      sirene_verified_at: now,
      badge_level: 'verified',
      badge_level_granted_at: now,
      manual_review_priority: 0,
    })
    .eq('diagnostician_id', diagId)

  if (error) throw new Error(`update_failed: ${error.message}`)

  await logCheck({
    diagId,
    adminId,
    checkType: 'manual_audit',
    status: 'success',
    result: { action: 'approve_all_phases' },
  })

  revalidatePath('/admin/verifications/queue')
}

/**
 * Rejette UNE phase précise (identity / cofrac / rcpro / sirene) avec raison.
 */
export async function rejectPhaseAction(formData: FormData): Promise<void> {
  const adminId = await requireAdmin()
  const diagId = pickStringField(formData, 'diagId')
  const phase = pickStringField(formData, 'phase') as VerificationPhase | null
  const reason = pickStringField(formData, 'reason')

  if (!diagId) throw new Error('diagId requis')
  if (!phase || !['identity', 'cofrac', 'rcpro', 'sirene'].includes(phase)) {
    throw new Error('phase invalide')
  }
  if (!reason) throw new Error('reason requise')

  const supabase = createAdminClient()
  const patch: Record<string, unknown> = {
    [`${phase}_status`]: 'rejected',
    [`${phase}_rejection_reason`]: reason,
  }

  // biome-ignore lint/suspicious/noExplicitAny: types regen pending pour table VAL-1
  const { error } = await (supabase as any)
    .from('diagnostician_verification_status')
    .update(patch)
    .eq('diagnostician_id', diagId)

  if (error) throw new Error(`update_failed: ${error.message}`)

  await logCheck({
    diagId,
    adminId,
    checkType: `${phase}_initial` as
      | 'identity_initial'
      | 'cofrac_initial'
      | 'rcpro_initial'
      | 'sirene_initial',
    status: 'failure',
    result: { action: 'reject_phase', phase, reason },
  })

  revalidatePath('/admin/verifications/queue')
}

/**
 * Relance une vérification automatisée pour une phase précise (ré-invoque
 * l'Edge Function verify-<phase>).
 */
export async function rerunAutomatedVerificationAction(formData: FormData): Promise<void> {
  const adminId = await requireAdmin()
  const diagId = pickStringField(formData, 'diagId')
  const phase = pickStringField(formData, 'phase') as VerificationPhase | null

  if (!diagId) throw new Error('diagId requis')
  if (!phase || !['identity', 'cofrac', 'rcpro', 'sirene'].includes(phase)) {
    throw new Error('phase invalide')
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRole) {
    throw new Error('Supabase env non configuré')
  }

  const fnName = `verify-${phase}`
  const resp = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceRole}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ diagnostician_id: diagId, mode: 'admin_rerun' }),
  })

  await logCheck({
    diagId,
    adminId,
    checkType: `${phase}_initial` as
      | 'identity_initial'
      | 'cofrac_initial'
      | 'rcpro_initial'
      | 'sirene_initial',
    status: resp.ok ? 'success' : 'failure',
    result: { action: 'rerun_automated', phase, http_status: resp.status },
  })

  revalidatePath('/admin/verifications/queue')
}

/**
 * Octroie le badge "Vérifié+" (manuel uniquement — récompense ancienneté +
 * qualité + 0 signalement).
 */
export async function grantVerifiedPlusAction(formData: FormData): Promise<void> {
  const adminId = await requireAdmin()
  const diagId = pickStringField(formData, 'diagId')
  if (!diagId) throw new Error('diagId requis')

  const supabase = createAdminClient()
  // biome-ignore lint/suspicious/noExplicitAny: types regen pending pour table VAL-1
  const { error } = await (supabase as any)
    .from('diagnostician_verification_status')
    .update({
      badge_level: 'verified_plus',
      badge_level_granted_at: new Date().toISOString(),
    })
    .eq('diagnostician_id', diagId)
    .eq('overall_status', 'verified') // doit déjà être verified pour upgrade

  if (error) throw new Error(`update_failed: ${error.message}`)

  await logCheck({
    diagId,
    adminId,
    checkType: 'manual_audit',
    status: 'success',
    result: { action: 'grant_verified_plus' },
  })

  revalidatePath('/admin/verifications/queue')
}

/**
 * Suspension manuelle — bascule badge_level='unverified' + INSERT signalement
 * system + alerte critical.
 */
export async function suspendDiagnosticianAction(formData: FormData): Promise<void> {
  const adminId = await requireAdmin()
  const diagId = pickStringField(formData, 'diagId')
  const reason = pickStringField(formData, 'reason')

  if (!diagId) throw new Error('diagId requis')
  if (!reason) throw new Error('reason requise')

  const supabase = createAdminClient()

  // biome-ignore lint/suspicious/noExplicitAny: types regen pending pour table VAL-1
  const sb = supabase as any
  const { error: updErr } = await sb
    .from('diagnostician_verification_status')
    .update({
      badge_level: 'unverified',
      manual_review_priority: 100,
    })
    .eq('diagnostician_id', diagId)

  if (updErr) throw new Error(`update_failed: ${updErr.message}`)

  // INSERT signalement system pour traçabilité
  await sb.from('diagnostician_signalements').insert({
    diagnostician_id: diagId,
    reporter_email: 'system@kovas.fr',
    reporter_ip_hash: 'system-suspension',
    reason: 'autre',
    description: `Suspension administrative — ${reason}`,
    status: 'confirmed_fraud',
    investigated_by: adminId,
    resolved_at: new Date().toISOString(),
    resolution_notes: `Suspension manuelle par admin (${reason})`,
  })

  await logCheck({
    diagId,
    adminId,
    checkType: 'manual_audit',
    status: 'warning',
    result: { action: 'suspend', reason },
  })

  revalidatePath('/admin/verifications/queue')
  revalidatePath('/admin/signalements')
}

/**
 * Server actions pour /admin/signalements.
 */
export async function reviewSignalementAction(formData: FormData): Promise<void> {
  const adminId = await requireAdmin()
  const signalementId = pickStringField(formData, 'signalementId')
  const outcome = pickStringField(formData, 'outcome') // confirmed_fraud | dismissed | investigating | resolved
  const notes = pickStringField(formData, 'notes')

  if (!signalementId) throw new Error('signalementId requis')
  if (
    !outcome ||
    !['confirmed_fraud', 'dismissed', 'investigating', 'resolved'].includes(outcome)
  ) {
    throw new Error('outcome invalide')
  }

  const supabase = createAdminClient()
  const isFinal = outcome === 'confirmed_fraud' || outcome === 'dismissed' || outcome === 'resolved'
  // biome-ignore lint/suspicious/noExplicitAny: types regen pending pour table VAL-1
  const { error } = await (supabase as any)
    .from('diagnostician_signalements')
    .update({
      status: outcome,
      investigated_by: adminId,
      resolved_at: isFinal ? new Date().toISOString() : null,
      resolution_notes: notes,
    })
    .eq('id', signalementId)

  if (error) throw new Error(`update_failed: ${error.message}`)

  revalidatePath('/admin/signalements')
}
