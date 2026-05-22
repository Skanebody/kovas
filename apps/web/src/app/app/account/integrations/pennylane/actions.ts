'use server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { deleteConnector, updateConnector, upsertConnector } from '@/lib/pennylane'
import { encryptSecret } from '@/lib/security/encrypt'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type ConnectorFormState =
  | {
      error?: string
      success?: boolean
      message?: string
    }
  | undefined

const PROVIDER = 'pennylane' as const

const SaveSchema = z.object({
  apiToken: z
    .string()
    .trim()
    .min(10, 'Token Pennylane invalide (trop court).')
    .max(500, 'Token Pennylane invalide (trop long).'),
  activate: z
    .string()
    .optional()
    .transform((v) => v === 'on' || v === 'true'),
})

/**
 * Persiste un token Pennylane chiffré + active le connecteur si demandé.
 * Ne stocke JAMAIS le token en clair.
 */
export async function saveConnectorAction(
  _prev: ConnectorFormState,
  formData: FormData,
): Promise<ConnectorFormState> {
  const parsed = SaveSchema.safeParse({
    apiToken: formData.get('apiToken'),
    activate: formData.get('activate'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides.' }
  }

  const { supabase, orgId } = await getCurrentUser()

  let encrypted: string
  try {
    encrypted = encryptSecret(parsed.data.apiToken)
  } catch (err) {
    return {
      error: `Configuration chiffrement absente côté serveur (${
        err instanceof Error ? err.message : 'erreur inconnue'
      }). Contactez le support.`,
    }
  }

  const { error } = await upsertConnector(supabase, {
    organization_id: orgId,
    provider: PROVIDER,
    encrypted_token: encrypted,
    status: parsed.data.activate ? 'active' : 'inactive',
    updated_at: new Date().toISOString(),
  })

  if (error) {
    return { error: `Échec sauvegarde : ${error.message}` }
  }

  revalidatePath('/app/account/integrations/pennylane')
  return { success: true, message: 'Connecteur Pennylane enregistré.' }
}

/**
 * Désactive le connecteur (status = 'inactive') sans supprimer le token chiffré.
 * Préserve la possibilité de réactiver sans ressaisir.
 */
export async function deactivateConnectorAction(): Promise<ConnectorFormState> {
  const { supabase, orgId } = await getCurrentUser()
  const { error } = await updateConnector(supabase, orgId, PROVIDER, {
    status: 'inactive',
    updated_at: new Date().toISOString(),
  })

  if (error) return { error: `Échec désactivation : ${error.message}` }
  revalidatePath('/app/account/integrations/pennylane')
  return { success: true, message: 'Connecteur Pennylane désactivé.' }
}

/**
 * Supprime intégralement le connecteur Pennylane (token effacé).
 */
export async function deleteConnectorAction(): Promise<ConnectorFormState> {
  const { supabase, orgId } = await getCurrentUser()
  const { error } = await deleteConnector(supabase, orgId, PROVIDER)

  if (error) return { error: `Échec suppression : ${error.message}` }
  revalidatePath('/app/account/integrations/pennylane')
  return { success: true, message: 'Connecteur Pennylane supprimé.' }
}
