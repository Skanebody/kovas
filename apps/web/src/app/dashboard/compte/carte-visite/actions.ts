'use server'

/**
 * Server actions de la page `/dashboard/compte/carte-visite`.
 *
 * - `upsertBusinessCardAction` : update des toggles + champs custom.
 * - `regeneratePublicTokenAction` : génère un nouveau token aléatoire et
 *   invalide l'ancien lien public.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth/current-user'
import { libphonenumberSafeParse } from './phone-validator'

const upsertSchema = z.object({
  show_phone_mobile: z.boolean(),
  show_phone_fixed: z.boolean(),
  show_email: z.boolean(),
  show_address: z.boolean(),
  show_website: z.boolean(),
  show_certification: z.boolean(),
  show_siret: z.boolean(),
  show_logo: z.boolean(),
  custom_title: z.string().trim().max(80).nullable().optional(),
  custom_website: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .refine(
      (v) => !v || /^https?:\/\/[^\s]+$/.test(v),
      "L'URL doit commencer par http:// ou https://",
    ),
  custom_phone_fixed: z
    .string()
    .trim()
    .max(20)
    .nullable()
    .optional()
    .refine(
      (v) => !v || libphonenumberSafeParse(v),
      'Numéro de téléphone invalide (format attendu E.164, ex: +33235123456)',
    ),
})

export type BusinessCardFormState =
  | { error?: string; success?: boolean; fieldErrors?: Record<string, string> }
  | undefined

export async function upsertBusinessCardAction(
  input: unknown,
): Promise<BusinessCardFormState> {
  const parsed = upsertSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      if (key) fieldErrors[key] = issue.message
    }
    return {
      error: parsed.error.issues[0]?.message ?? 'Données invalides',
      fieldErrors,
    }
  }

  const { supabase, orgId, user } = await getCurrentUser()

  // Cast minimal — business_cards pas dans Database types regen.
  const client = supabase as unknown as {
    from: (t: string) => {
      upsert: (
        row: Record<string, unknown>,
        opts?: { onConflict?: string },
      ) => Promise<{ error: { message: string } | null }>
    }
  }

  const { error } = await client.from('business_cards').upsert(
    {
      organization_id: orgId,
      user_id: user.id,
      ...parsed.data,
      custom_title: parsed.data.custom_title || null,
      custom_website: parsed.data.custom_website || null,
      custom_phone_fixed: parsed.data.custom_phone_fixed || null,
    },
    { onConflict: 'organization_id' },
  )

  if (error) {
    return { error: `Enregistrement échoué : ${error.message}` }
  }

  revalidatePath('/dashboard/compte/carte-visite')
  return { success: true }
}

export async function regeneratePublicTokenAction(): Promise<BusinessCardFormState> {
  const { supabase, orgId } = await getCurrentUser()

  // On délègue à Postgres la génération via la valeur par défaut de la colonne
  // (encode(gen_random_bytes(16), 'hex')). On exécute une RPC inline en
  // construisant manuellement la nouvelle valeur côté Node (crypto.randomBytes).
  const { randomBytes } = await import('node:crypto')
  const newToken = randomBytes(16).toString('hex')

  const client = supabase as unknown as {
    from: (t: string) => {
      update: (row: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{
          error: { message: string } | null
        }>
      }
    }
  }

  const { error } = await client
    .from('business_cards')
    .update({ public_token: newToken })
    .eq('organization_id', orgId)

  if (error) {
    return { error: `Régénération échouée : ${error.message}` }
  }

  revalidatePath('/dashboard/compte/carte-visite')
  return { success: true }
}
