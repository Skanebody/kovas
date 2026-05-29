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
 *  - Les champs marketing additionnels (display_name, title, slogan,
 *    languages) vivent aussi sur `diagnostician_public_profile`
 *    (migration 20260628300000). `years_experience` → diagnosticians.years_active.
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
  // → diagnostician_public_profile.display_name (migration 20260628300000).
  displayName: z.string().trim().min(2, 'Nom trop court').max(80, 'Nom trop long'),
  // → diagnostician_public_profile.title (migration 20260628300000).
  title: z.string().trim().max(120, 'Titre trop long').optional().or(z.literal('')),
  // → diagnostician_public_profile.slogan (migration 20260628300000, max 80c).
  slogan: z.string().trim().max(80, 'Slogan max 80 caractères').optional().or(z.literal('')),
  // `bio` (text) existe sur `diagnosticians` + bio_short/bio_long sur
  // `diagnostician_public_profile`. On utilise bio_short pour V1.
  bio: z.string().trim().max(500, 'Bio max 500 caractères').optional().or(z.literal('')),
  // → diagnostician_public_profile.languages text[] (migration 20260628300000).
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
 * Persistance :
 *  - `bio`            → diagnosticians.bio + diagnostician_public_profile.bio_short
 *  - `yearsExperience`→ diagnosticians.years_active
 *  - `displayName` / `title` / `slogan` / `languages`
 *                     → diagnostician_public_profile (colonnes ajoutées par la
 *                       migration 20260628300000_diagnostician_profile_fields.sql).
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

  // 3. Upsert dans `diagnostician_public_profile` — vitrine publique éditable.
  //    bio_short + champs marketing (display_name, title, slogan, languages).
  //    Colonnes marketing ajoutées par 20260628300000_diagnostician_profile_fields.sql.
  const profileUpdate: Record<string, unknown> = {
    diagnostician_id: diagnosticianId,
    display_name: parsed.data.displayName,
    title: parsed.data.title?.trim() || null,
    slogan: parsed.data.slogan?.trim() || null,
    languages: parsed.data.languages,
  }
  // bio_short conservé tel quel : null efface la bio, valeur la met à jour.
  if (bioTrimmed !== undefined) profileUpdate.bio_short = bioTrimmed

  const { error: profileErr } = await sb
    .from('diagnostician_public_profile')
    .upsert(profileUpdate, { onConflict: 'diagnostician_id' })
  if (profileErr) {
    return { error: `Échec de la sauvegarde du profil public : ${profileErr.message}` }
  }

  revalidatePath('/dashboard/annuaire/ma-fiche')
  revalidatePath('/dashboard/annuaire')

  return { ok: true }
}

/* ------------------------------------------------------------------ */
/* Réponse aux avis annuaire (marketplace_reviews)                    */
/* ------------------------------------------------------------------ */

export type ReplyToReviewState =
  | {
      ok?: boolean
      error?: string
    }
  | undefined

const replySchema = z.object({
  reviewId: z.string().uuid('Avis introuvable'),
  reply: z
    .string()
    .trim()
    .min(2, 'Réponse trop courte')
    .max(1000, 'Réponse trop longue (1000 max)'),
})

/**
 * Répond à un avis annuaire (reply + reply_at).
 *
 * Sécurité : l'écriture passe par le client Supabase authentifié de l'user, donc
 * la policy RLS `marketplace_reviews_owner_update` garantit qu'il ne peut
 * répondre qu'aux avis d'une fiche `diagnosticians` qu'il a réclamée. On
 * re-vérifie quand même l'ownership côté serveur (defense-in-depth) avant
 * l'UPDATE pour renvoyer un message clair plutôt qu'un échec RLS silencieux.
 */
export async function replyToReview(
  _prev: ReplyToReviewState,
  formData: FormData,
): Promise<ReplyToReviewState> {
  const parsed = replySchema.safeParse({
    reviewId: formData.get('reviewId') ?? '',
    reply: formData.get('reply') ?? '',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  const { user, supabase } = await getCurrentUser()
  // biome-ignore lint/suspicious/noExplicitAny: types DB Supabase en attente de régénération (migration 20260628400000)
  const sb = supabase as any

  // 1. Vérifie que l'avis appartient à une fiche réclamée par l'utilisateur.
  const { data: review } = await sb
    .from('marketplace_reviews')
    .select('id, diagnostician_id, diagnosticians!inner(claimed_by_user_id)')
    .eq('id', parsed.data.reviewId)
    .maybeSingle()

  const ownerId = review?.diagnosticians?.claimed_by_user_id as string | undefined
  if (!review?.id || ownerId !== user.id) {
    return { error: "Cet avis n'est pas rattaché à ta fiche." }
  }

  // 2. Persiste la réponse (reply + reply_at). RLS protège déjà l'écriture.
  const { error } = await sb
    .from('marketplace_reviews')
    .update({ reply: parsed.data.reply, reply_at: new Date().toISOString() })
    .eq('id', parsed.data.reviewId)

  if (error) {
    return { error: `Échec de l'enregistrement de la réponse : ${error.message}` }
  }

  revalidatePath('/dashboard/annuaire/reviews')
  return { ok: true }
}
