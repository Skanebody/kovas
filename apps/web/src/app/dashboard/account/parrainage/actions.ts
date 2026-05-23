'use server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { ensureReferralCode } from '@/lib/referral/code-generator'
import { revalidatePath } from 'next/cache'

export type ReferralActionState =
  | { ok?: boolean; error?: string; code?: string }
  | undefined

/**
 * Génère (ou retourne) le code de parrainage de l'utilisateur courant.
 *
 * Idempotent : si un code existe déjà → retourné sans création.
 * Sinon → INSERT en DB avec retry sur collision UNIQUE.
 *
 * Cette server action est appelée :
 *   - automatiquement au chargement de la page parrainage (via la page server
 *     component qui invoque `ensureReferralCode` au render)
 *   - manuellement via formulaire fallback si la génération auto a échoué
 *     (par ex. cookies tiers désactivés cassant le user JWT)
 */
export async function generateReferralCode(
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
      error: err instanceof Error ? err.message : 'Génération du code impossible',
    }
  }
}

/**
 * Alias historique — conservé pour la rétro-compatibilité (formulaires
 * existants qui pourraient encore référencer `ensureMyReferralCodeAction`).
 *
 * @deprecated Préférer `generateReferralCode`.
 */
export const ensureMyReferralCodeAction = generateReferralCode
