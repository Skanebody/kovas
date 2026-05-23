'use server'

/**
 * KOVAS — Actions /dashboard/annuaire (édition fiche publique).
 *
 * - updatePublicProfileAction : édite la table diagnostician_public_profile
 *
 * Sécurité :
 *  - Lecture du diagnostician_id via diagnosticians.claimed_by_user_id = user.id
 *  - L'action ne peut écrire que sur le profil dont l'utilisateur est propriétaire
 *    (RLS l'empêcherait de toute façon, mais on vérifie en amont pour
 *    un meilleur message d'erreur).
 */

import { getCurrentUser } from '@/lib/auth/current-user'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type AnnuaireFormState =
  | { error?: string; success?: boolean; fieldErrors?: Record<string, string> }
  | undefined

const SPECIALTY_VALUES = [
  'DPE',
  'AMIANTE',
  'PLOMB',
  'GAZ',
  'ELEC',
  'TERMITES',
  'CARREZ',
  'ERP',
] as const

const profileSchema = z.object({
  bio_short: z.string().trim().max(300).optional().or(z.literal('')),
  bio_long: z.string().trim().max(2000).optional().or(z.literal('')),
  intervention_zones: z.array(z.string().trim().min(1).max(80)).max(10, 'Maximum 10 zones'),
  specialties: z.array(z.enum(SPECIALTY_VALUES)).max(SPECIALTY_VALUES.length),
})

function parseSpecialties(formData: FormData): string[] {
  const out: string[] = []
  for (const v of SPECIALTY_VALUES) {
    if (formData.get(`specialty_${v}`) === 'on') out.push(v)
  }
  return out
}

function parseZones(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== 'string') return []
  return raw
    .split(',')
    .map((z) => z.trim())
    .filter((z) => z.length > 0)
    .slice(0, 10)
}

function parseOpeningHours(formData: FormData): Record<string, { open: string; close: string }> {
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const out: Record<string, { open: string; close: string }> = {}
  for (const d of days) {
    const open = formData.get(`oh_${d}_open`)
    const close = formData.get(`oh_${d}_close`)
    if (
      typeof open === 'string' &&
      typeof close === 'string' &&
      /^\d{2}:\d{2}$/.test(open) &&
      /^\d{2}:\d{2}$/.test(close) &&
      open < close
    ) {
      out[d] = { open, close }
    }
  }
  return out
}

export async function updatePublicProfileAction(
  _prev: AnnuaireFormState,
  formData: FormData,
): Promise<AnnuaireFormState> {
  const { user, supabase } = await getCurrentUser()

  // 1. Trouver le diagnostician_id du user courant
  // biome-ignore lint/suspicious/noExplicitAny: diagnosticians table types pending regen
  const diagRes = await (supabase as any)
    .from('diagnosticians')
    .select('id')
    .eq('claimed_by_user_id', user.id)
    .maybeSingle()

  const diagId = (diagRes.data as { id?: string } | null)?.id ?? null
  if (!diagId) {
    return {
      error:
        "Aucune fiche diagnostiqueur revendiquée. Revendiquez d'abord votre fiche dans l'annuaire.",
    }
  }

  // 2. Parse formData
  const zones = parseZones(formData.get('intervention_zones'))
  const specialties = parseSpecialties(formData)

  const parsed = profileSchema.safeParse({
    bio_short: formData.get('bio_short') ?? '',
    bio_long: formData.get('bio_long') ?? '',
    intervention_zones: zones,
    specialties,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  const openingHours = parseOpeningHours(formData)

  // 3. Upsert
  // biome-ignore lint/suspicious/noExplicitAny: diagnostician_public_profile table types pending regen
  const { error } = await (supabase as any).from('diagnostician_public_profile').upsert(
    {
      diagnostician_id: diagId,
      bio_short: parsed.data.bio_short || null,
      bio_long: parsed.data.bio_long || null,
      intervention_zones: parsed.data.intervention_zones,
      specialties: parsed.data.specialties,
      opening_hours: openingHours,
    },
    { onConflict: 'diagnostician_id' },
  )

  if (error) return { error: error.message }

  revalidatePath('/dashboard/annuaire')
  return { success: true }
}
