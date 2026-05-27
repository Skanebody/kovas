/**
 * Helper : lie une demande de claim vérifiée à un user nouvellement créé.
 *
 * Utilisé par `apps/web/src/app/(auth)/signup/actions.ts` au merge avec
 * Mission A4 — appelé après `auth.admin.createUser()` si la requête
 * de signup contient `?claim_id=<uuid>`.
 *
 * Logique :
 * 1. Charge la claim_requests par id (service_role)
 * 2. Vérifie status = 'verified' (sinon refuse silencieusement)
 * 3. Update diagnosticians.claimed_by_user_id + claim_status='claimed' + claimed_at
 * 4. Marque claim_requests.user_id_created
 *
 * En cas d'échec partiel : non bloquant pour le signup (logged côté serveur).
 */

import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export interface LinkClaimResult {
  linked: boolean
  reason?:
    | 'claim_not_found'
    | 'claim_not_verified'
    | 'diagnostician_not_found'
    | 'already_claimed'
    | 'db_error'
  diagnosticianId?: string
}

/**
 * Lie un claim_id à un user_id (post-signup).
 * À appeler avec service_role uniquement (server-side).
 */
export async function linkClaimToUser(opts: {
  claimId: string
  userId: string
}): Promise<LinkClaimResult> {
  const { claimId, userId } = opts

  if (!claimId || !userId) {
    return { linked: false, reason: 'claim_not_found' }
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // Types pas encore regen pour claim_requests / diagnosticians (cast as any)
  // biome-ignore lint/suspicious/noExplicitAny: types regen post-merge A1+A4
  const adminAny = admin as any

  // 1. Charge la claim
  const { data: claim, error: claimErr } = await adminAny
    .from('claim_requests')
    .select('id, diagnostician_id, status')
    .eq('id', claimId)
    .maybeSingle()

  if (claimErr || !claim) {
    return { linked: false, reason: 'claim_not_found' }
  }
  if (claim.status !== 'verified') {
    return { linked: false, reason: 'claim_not_verified' }
  }

  // 2. Charge le diag et vérifie qu'il n'est pas déjà claimed par quelqu'un d'autre
  const { data: diag, error: diagErr } = await adminAny
    .from('diagnosticians')
    .select('id, claim_status, claimed_by_user_id')
    .eq('id', claim.diagnostician_id)
    .maybeSingle()

  if (diagErr || !diag) {
    return { linked: false, reason: 'diagnostician_not_found' }
  }
  if (
    diag.claim_status === 'claimed' &&
    diag.claimed_by_user_id &&
    diag.claimed_by_user_id !== userId
  ) {
    return { linked: false, reason: 'already_claimed', diagnosticianId: diag.id }
  }

  // 3. Update diagnostician
  const { error: updErr } = await adminAny
    .from('diagnosticians')
    .update({
      claimed_by_user_id: userId,
      claim_status: 'claimed',
      claimed_at: new Date().toISOString(),
    })
    .eq('id', diag.id)

  if (updErr) {
    return { linked: false, reason: 'db_error', diagnosticianId: diag.id }
  }

  // 4. Marque la claim avec l'id user créé (audit trail)
  await adminAny.from('claim_requests').update({ user_id_created: userId }).eq('id', claimId)

  return { linked: true, diagnosticianId: diag.id }
}
