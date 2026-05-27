'use server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

/**
 * Server actions du module annuaire dashboard (hub + Ma fiche).
 *
 * Conventions :
 *  - Tous les uploads / éditions passent par le `claim_status='claimed'`
 *    de la fiche `diagnosticians` rattachée à `auth.uid()`.
 *  - Le bio long/short + zones d'intervention vivent dans
 *    `diagnostician_public_profile` (migration 20260524290000).
 *  - Les champs marketing additionnels (title, slogan, languages,
 *    years_experience) ne sont pas encore en DB — laissés en TODO.
 */

export type AnnuaireProfileFormState =
  | {
      ok?: boolean
      error?: string
      fieldErrors?: Record<string, string>
    }
  | undefined

// Liste blanche des langues parlées (ISO 639-1) — V1 limitée FR/EN/ES/DE.
const LANGUAGE_CODES = ['fr', 'en', 'es', 'de'] as const
type LanguageCode = (typeof LANGUAGE_CODES)[number]

const profileFormSchema = z.object({
  // `display_name` n'existe pas encore — TODO: migration column `display_name` sur diagnosticians.
  displayName: z.string().trim().min(2, 'Nom trop court').max(80, 'Nom trop long'),
  // `title` n'existe pas encore — TODO: migration column `title`.
  title: z.string().trim().max(120, 'Titre trop long').optional().or(z.literal('')),
  // `slogan` n'existe pas encore — TODO: migration column `slogan` (max 80c).
  slogan: z.string().trim().max(80, 'Slogan max 80 caractères').optional().or(z.literal('')),
  // `bio` (text) existe sur `diagnosticians` + bio_short/bio_long sur
  // `diagnostician_public_profile`. On utilise bio_short pour V1.
  bio: z.string().trim().max(500, 'Bio max 500 caractères').optional().or(z.literal('')),
  // `languages` n'existe pas encore — TODO: migration column `languages text[]`.
  languages: z.array(z.enum(LANGUAGE_CODES)).max(LANGUAGE_CODES.length).default([]),
  // `years_active` existe (integer) sur diagnosticians. On le réutilise pour
  // l'expérience années.
  yearsExperience: z
    .union([z.literal(''), z.coerce.number().int().min(0).max(60)])
    .optional()
    .transform((v) => (v === '' || v === undefined ? null : v)),
})

function parseLanguages(formData: FormData): LanguageCode[] {
  const raw = formData.getAll('languages').map(String)
  return raw.filter((v): v is LanguageCode => (LANGUAGE_CODES as readonly string[]).includes(v))
}

function zodFieldErrors(
  issues: ReadonlyArray<{ path: ReadonlyArray<string | number>; message: string }>,
): Record<string, string> {
  return Object.fromEntries(issues.map((i) => [i.path.join('.'), i.message]))
}

/**
 * Update du profil annuaire (section Profil de "Ma fiche").
 *
 * V1 : seuls `bio` (→ diagnosticians.bio + diagnostician_public_profile.bio_short)
 * et `yearsExperience` (→ diagnosticians.years_active) sont persistés.
 * Les autres champs (displayName, title, slogan, languages) sont validés
 * mais leur persistence est en attente des colonnes DB associées.
 */
export async function updateAnnuaireProfile(
  _prev: AnnuaireProfileFormState,
  formData: FormData,
): Promise<AnnuaireProfileFormState> {
  const parsed = profileFormSchema.safeParse({
    displayName: formData.get('displayName') ?? '',
    title: formData.get('title') ?? '',
    slogan: formData.get('slogan') ?? '',
    bio: formData.get('bio') ?? '',
    languages: parseLanguages(formData),
    yearsExperience: formData.get('yearsExperience') ?? '',
  })

  if (!parsed.success) {
    return {
      error: 'Données invalides',
      fieldErrors: zodFieldErrors(parsed.error.issues),
    }
  }

  const { user, supabase } = await getCurrentUser()

  // 1. Récupère la fiche diagnostician revendiquée par l'utilisateur.
  // biome-ignore lint/suspicious/noExplicitAny: types DB Supabase régénérés async
  const sb = supabase as any

  const { data: diag } = await sb
    .from('diagnosticians')
    .select('id')
    .eq('claimed_by_user_id', user.id)
    .maybeSingle()

  if (!diag?.id) {
    return {
      error:
        "Aucune fiche annuaire revendiquée n'est associée à ton compte. Active ta fiche depuis le hub annuaire.",
    }
  }

  const diagnosticianId = diag.id as string
  const bioTrimmed = parsed.data.bio?.trim() || null
  const yearsExperience = parsed.data.yearsExperience

  // 2. Update `diagnosticians` (bio + years_active uniquement pour V1).
  const diagUpdate: Record<string, unknown> = {}
  if (bioTrimmed !== undefined) diagUpdate.bio = bioTrimmed
  if (yearsExperience !== null && yearsExperience !== undefined) {
    diagUpdate.years_active = yearsExperience
  }

  if (Object.keys(diagUpdate).length > 0) {
    const { error: diagErr } = await sb
      .from('diagnosticians')
      .update(diagUpdate)
      .eq('id', diagnosticianId)
    if (diagErr) {
      return { error: `Échec de la sauvegarde : ${diagErr.message}` }
    }
  }

  // 3. Upsert dans `diagnostician_public_profile` (bio_short pour la vitrine
  // publique). Bio long reste éditable depuis la section "Bio complète" future.
  if (bioTrimmed !== null) {
    const { error: profileErr } = await sb.from('diagnostician_public_profile').upsert(
      {
        diagnostician_id: diagnosticianId,
        bio_short: bioTrimmed,
      },
      { onConflict: 'diagnostician_id' },
    )
    if (profileErr) {
      return { error: `Échec de la sauvegarde du profil public : ${profileErr.message}` }
    }
  }

  // TODO: migration column displayName / title / slogan / languages
  //  Quand la migration sera appliquée, ajouter ici :
  //   diagUpdate.display_name = parsed.data.displayName
  //   diagUpdate.title         = parsed.data.title || null
  //   diagUpdate.slogan        = parsed.data.slogan || null
  //   diagUpdate.languages     = parsed.data.languages
  void parsed.data.displayName
  void parsed.data.title
  void parsed.data.slogan
  void parsed.data.languages

  revalidatePath('/dashboard/annuaire/ma-fiche')
  revalidatePath('/dashboard/annuaire')

  return { ok: true }
}
