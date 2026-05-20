'use server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { revalidatePath } from 'next/cache'

/**
 * Annule un RDV depuis le calendrier — status='cancelled' sur le dossier.
 *
 * Cas d'usage : EventDetailSheet bouton "Annuler le RDV". Réutilise la même
 * mécanique que `updateDossierStatusAction(id, 'cancelled')` mais simplifiée
 * en un seul appel (pas de paramètre status à valider côté client).
 *
 * RLS : l'UPDATE est sécurisé via la policy `dossiers.organization_id =
 * auth.organization_id()` côté Postgres.
 */
export async function cancelDossierAction(dossierId: string): Promise<void> {
  if (typeof dossierId !== 'string' || dossierId.length === 0) {
    throw new Error('ID dossier requis')
  }
  const { supabase, orgId } = await getCurrentUser()

  const { error } = await supabase
    .from('dossiers')
    .update({ status: 'cancelled' })
    .eq('id', dossierId)
    .eq('organization_id', orgId)

  if (error) throw new Error(error.message)

  revalidatePath('/app/calendar')
  revalidatePath('/app/dossiers')
  revalidatePath(`/app/dossiers/${dossierId}`)
  revalidatePath('/app/dashboard')
}
