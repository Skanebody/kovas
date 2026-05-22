'use server'

import { getCurrentUser } from '@/lib/auth/current-user'
import {
  type DiagnosticType,
  type Usage,
  calculateExpiration,
} from '@/lib/diagnostic-validity/expiration-calculator'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

export interface ConfirmScanInput {
  scanId: string
  diagnostic_type: DiagnosticType
  date_emission: string
  client_id: string | null
  property_id: string | null
  usage_context: Usage
  result_positive: boolean | null
  energy_class: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null
  ademe_number: string | null
}

/**
 * Confirme un scan analysé après édition utilisateur — recalcule la date
 * d'expiration en serveur (cohérence), rattache au client/bien, passe en
 * status 'confirmed'.
 */
export async function confirmDiagnosticScanAction(input: ConfirmScanInput) {
  const { supabase, orgId } = await getCurrentUser()

  const exp = calculateExpiration({
    type: input.diagnostic_type,
    dateEmission: input.date_emission,
    usage: input.usage_context,
    resultPositive: input.result_positive ?? undefined,
  })

  const { error } = await supabase
    .from('diagnostic_scans')
    .update({
      diagnostic_type: input.diagnostic_type,
      date_emission: input.date_emission,
      date_expiration: exp.dateExpiration,
      client_id: input.client_id,
      property_id: input.property_id,
      usage_context: input.usage_context,
      result_positive: input.result_positive,
      energy_class: input.energy_class,
      ademe_number: input.ademe_number,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    })
    .eq('id', input.scanId)
    .eq('organization_id', orgId)

  if (error) {
    throw new Error(`Confirmation échouée : ${error.message}`)
  }

  revalidatePath('/dashboard/outils/verification-validite')
  if (input.client_id) revalidatePath(`/dashboard/clients/${input.client_id}`)
  if (input.property_id) revalidatePath(`/dashboard/properties/${input.property_id}`)
}

/**
 * Rejette un scan (le scan reste en base avec status 'rejected', mais
 * disparait des encarts client/bien).
 */
export async function rejectDiagnosticScanAction(scanId: string) {
  const { supabase, orgId } = await getCurrentUser()
  const { error } = await supabase
    .from('diagnostic_scans')
    .update({ status: 'rejected', rejected_at: new Date().toISOString() })
    .eq('id', scanId)
    .eq('organization_id', orgId)
  if (error) {
    throw new Error(`Rejet échoué : ${error.message}`)
  }
  revalidatePath('/dashboard/outils/verification-validite')
}

/**
 * Suppression définitive (soft delete) — utilisé depuis la liste historique.
 */
export async function deleteDiagnosticScanAction(scanId: string) {
  const { supabase, orgId } = await getCurrentUser()

  // Récupère le storage path pour cleanup
  const { data: scan } = await supabase
    .from('diagnostic_scans')
    .select('file_storage_path')
    .eq('id', scanId)
    .eq('organization_id', orgId)
    .single()

  const { error } = await supabase
    .from('diagnostic_scans')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', scanId)
    .eq('organization_id', orgId)
  if (error) {
    throw new Error(`Suppression échouée : ${error.message}`)
  }

  // Best-effort cleanup Storage via service_role (échec silencieux)
  if (scan?.file_storage_path && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    await admin.storage.from('diagnostic-scans').remove([scan.file_storage_path])
  }

  revalidatePath('/dashboard/outils/verification-validite')
}
