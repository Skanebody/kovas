'use server'

/**
 * Server Actions du module Leads (dashboard diagnostiqueur).
 *
 * Securite :
 *   - Auth user via getCurrentUser (redirige vers /login sinon)
 *   - Verification que le lead_assignment cible bien un diagnostician
 *     claime par l'user (lookup join diagnostician + claimed_by_user_id)
 *   - UPDATE atomique + incrementation de acceptance_count cote
 *     quote_requests pour traçabilite
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { asUntyped } from '@/lib/diagnosticians/supabase-untyped'
import { revalidatePath } from 'next/cache'

interface AssignmentLookupRow {
  id: string
  lead_id: string
  diagnostician_id: string
  status: string | null
  diagnosticians?: {
    id: string
    claimed_by_user_id: string | null
  } | null
}

interface QuoteRequestUnlockedRow {
  requester_first_name: string | null
  requester_last_name: string | null
  requester_email: string | null
  requester_phone: string | null
  property_address: string | null
  message: string | null
}

export interface AcceptLeadResult {
  ok: boolean
  error?: string
  assignment?: {
    requesterFirstName: string | null
    requesterLastName: string | null
    requesterEmail: string | null
    requesterPhone: string | null
    propertyAddress: string | null
    message: string | null
  }
}

export interface DeclineLeadResult {
  ok: boolean
  error?: string
}

/**
 * Verifie que l'assignment cible un diagnostician claime par l'user
 * et retourne la row (avec lead_id) ou null si refus d'acces.
 */
async function loadAndAuthorize(
  assignmentId: string,
): Promise<
  | { ok: true; row: AssignmentLookupRow; supabase: ReturnType<typeof asUntyped> }
  | { ok: false; error: string }
> {
  if (typeof assignmentId !== 'string' || assignmentId.length === 0) {
    return { ok: false, error: 'assignmentId invalide' }
  }
  const { supabase: typedSupabase, user } = await getCurrentUser()
  const supabase = asUntyped(typedSupabase)

  const { data, error } = await supabase
    .from('lead_assignments')
    .select('id, lead_id, diagnostician_id, status, diagnosticians(id, claimed_by_user_id)')
    .eq('id', assignmentId)
    .maybeSingle<AssignmentLookupRow>()

  if (error) {
    return { ok: false, error: error.message }
  }
  if (!data) {
    return { ok: false, error: 'Assignment introuvable.' }
  }
  if (data.diagnosticians?.claimed_by_user_id !== user.id) {
    return { ok: false, error: 'Acces refuse.' }
  }
  return { ok: true, row: data, supabase }
}

export async function acceptLeadAssignment(assignmentId: string): Promise<AcceptLeadResult> {
  const auth = await loadAndAuthorize(assignmentId)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }

  const { row, supabase } = auth

  if (row.status !== 'pending') {
    return { ok: false, error: `Assignment deja ${row.status ?? 'cloturé'}.` }
  }

  const nowIso = new Date().toISOString()

  // 1. UPDATE lead_assignments → accepted
  const { error: updateErr } = await supabase
    .from('lead_assignments')
    .update({ status: 'accepted', responded_at: nowIso })
    .eq('id', row.id)

  if (updateErr) {
    return { ok: false, error: updateErr.message }
  }

  // 2. Incremente acceptance_count cote quote_requests (best-effort)
  //    Pas critique : peut etre recompute via batch si echoue.
  const { data: qrRow } = await supabase
    .from('quote_requests')
    .select(
      'requester_first_name, requester_last_name, requester_email, requester_phone, property_address, message, acceptance_count',
    )
    .eq('id', row.lead_id)
    .maybeSingle<QuoteRequestUnlockedRow & { acceptance_count: number | null }>()

  if (qrRow) {
    const nextCount = (qrRow.acceptance_count ?? 0) + 1
    await supabase
      .from('quote_requests')
      .update({ acceptance_count: nextCount })
      .eq('id', row.lead_id)
  }

  revalidatePath('/dashboard/leads/incoming')

  return {
    ok: true,
    assignment: {
      requesterFirstName: qrRow?.requester_first_name ?? null,
      requesterLastName: qrRow?.requester_last_name ?? null,
      requesterEmail: qrRow?.requester_email ?? null,
      requesterPhone: qrRow?.requester_phone ?? null,
      propertyAddress: qrRow?.property_address ?? null,
      message: qrRow?.message ?? null,
    },
  }
}

export async function declineLeadAssignment(
  assignmentId: string,
  reason?: string,
): Promise<DeclineLeadResult> {
  const auth = await loadAndAuthorize(assignmentId)
  if (!auth.ok) {
    return { ok: false, error: auth.error }
  }

  const { row, supabase } = auth

  if (row.status !== 'pending') {
    return { ok: false, error: `Assignment deja ${row.status ?? 'cloturé'}.` }
  }

  const nowIso = new Date().toISOString()

  const update: Record<string, unknown> = {
    status: 'declined',
    responded_at: nowIso,
  }
  if (typeof reason === 'string' && reason.trim().length > 0) {
    update.decline_reason = reason.trim().slice(0, 280)
  }

  const { error } = await supabase.from('lead_assignments').update(update).eq('id', row.id)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath('/dashboard/leads/incoming')

  return { ok: true }
}
