'use server'

import { verifyAdminAccess } from '@/lib/admin/admin-middleware'
import { approveAnomaly, rejectAnomaly } from '@/lib/admin/signup-anomalies'
import { createAdminClient } from '@/lib/admin/supabase-admin'
import { revalidatePath } from 'next/cache'

/**
 * Server actions pour la page /admin/signup-anomalies (cabinets dont le NAF
 * déclaré au SIRENE ne correspond pas au périmètre diagnostic immobilier).
 *
 * Defense in depth : chaque action ré-appelle verifyAdminAccess() même si
 * le layout gated le fait déjà — cf. patterns admin/verifications/actions.ts.
 */

async function requireAdmin(): Promise<void> {
  const access = await verifyAdminAccess()
  if (!access.isAdmin || !access.user) {
    throw new Error('Accès non autorisé')
  }
}

export async function approveAnomalyAction(
  trialId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const supabase = createAdminClient()
  const result = await approveAnomaly(supabase, trialId)
  if (result.ok) revalidatePath('/admin/signup-anomalies')
  return result
}

export async function rejectAnomalyAction(
  trialId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin()
  const supabase = createAdminClient()
  const result = await rejectAnomaly(supabase, trialId)
  if (result.ok) revalidatePath('/admin/signup-anomalies')
  return result
}
