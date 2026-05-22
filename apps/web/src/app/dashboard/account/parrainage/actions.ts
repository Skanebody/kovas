'use server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { ensureReferralCode } from '@/lib/referral/code-generator'
import { revalidatePath } from 'next/cache'

export type ReferralActionState =
  | { ok?: boolean; error?: string; code?: string }
  | undefined

/**
 * Assure que l'utilisateur courant dispose d'un code de parrainage.
 * Idempotent. À appeler depuis la page parrainage (au mount ou via bouton).
 */
export async function ensureMyReferralCodeAction(
  _prev: ReferralActionState,
  _formData: FormData,
): Promise<ReferralActionState> {
  const { supabase, user } = await getCurrentUser()

  try {
    const code = await ensureReferralCode(supabase, user.id)
    revalidatePath('/dashboard/account/parrainage')
    return { ok: true, code }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Génération impossible',
    }
  }
}
