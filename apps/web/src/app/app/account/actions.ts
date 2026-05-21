'use server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { joinFullName } from '@/lib/name-utils'
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type FormState = { error?: string; success?: boolean } | undefined

// ============================================
// Profil utilisateur (table profiles)
// ============================================

const profileSchema = z.object({
  first_name: z.string().trim().min(1, 'Prénom requis').max(60),
  last_name: z.string().trim().min(1, 'Nom requis').max(60),
  phone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v && v.length > 0 ? v : null))
    .refine((v) => v === null || isValidPhoneNumber(v, 'FR'), {
      message: 'Numéro de téléphone invalide (format français attendu)',
    })
    .transform((v) => {
      if (!v) return null
      try {
        return parsePhoneNumber(v, 'FR').format('E.164')
      } catch {
        return v
      }
    }),
})

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = profileSchema.safeParse({
    first_name: formData.get('first_name'),
    last_name: formData.get('last_name'),
    phone: formData.get('phone') ?? '',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  // Recompose `full_name` pour stockage (schema legacy single-column)
  const full_name = joinFullName(parsed.data.first_name, parsed.data.last_name)

  const { supabase, user } = await getCurrentUser()

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name,
      phone: parsed.data.phone,
    })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/app/account')
  return { success: true }
}

// ============================================
// Entreprise (table organizations)
// ============================================

/** Validation SIRET basique : 14 chiffres + algo Luhn (sans appel INSEE pour V1) */
function isValidSiret(siret: string): boolean {
  const clean = siret.replace(/\s/g, '')
  if (!/^\d{14}$/.test(clean)) return false
  // Luhn check sur les 14 chiffres
  let sum = 0
  for (let i = 0; i < 14; i++) {
    let digit = Number(clean[i])
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum % 10 === 0
}

const orgSchema = z.object({
  name: z.string().trim().min(2).max(200),
  siret: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v && v.length > 0 ? v.replace(/\s/g, '') : null))
    .refine((v) => v === null || isValidSiret(v), {
      message: 'SIRET invalide (14 chiffres avec clé de contrôle Luhn)',
    }),
  vat_number: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((v) => (v && v.length > 0 ? v.toUpperCase().replace(/\s/g, '') : null))
    .refine((v) => v === null || /^FR\d{11}$/.test(v), {
      message: 'TVA invalide (format FR + 11 chiffres attendu)',
    }),
  address: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((v) => v || null),
  postal_code: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((v) => v || null)
    .refine((v) => v === null || /^\d{5}$/.test(v), {
      message: 'Code postal invalide (5 chiffres)',
    }),
  city: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((v) => v || null),
  certification_n: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .transform((v) => v || null),
})

export async function updateOrganizationAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = orgSchema.safeParse({
    name: formData.get('name'),
    siret: formData.get('siret') ?? '',
    vat_number: formData.get('vat_number') ?? '',
    address: formData.get('address') ?? '',
    postal_code: formData.get('postal_code') ?? '',
    city: formData.get('city') ?? '',
    certification_n: formData.get('certification_n') ?? '',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  const { supabase, orgId } = await getCurrentUser()

  const { error } = await supabase.from('organizations').update(parsed.data).eq('id', orgId)

  if (error) return { error: error.message }

  revalidatePath('/app/account')
  return { success: true }
}

// ============================================
// Préférences notifications (user_preferences)
// ============================================

/**
 * Toggle l'opt-in/opt-out du rapport mensuel d'activité (CLAUDE.md §21bis).
 * Upsert sur user_preferences — table créée 20260520180000_capture_first_mode.sql.
 */
export async function updateMonthlyReportPreferenceAction(
  enabled: boolean,
): Promise<FormState> {
  const { supabase, user } = await getCurrentUser()

  // user_preferences pas encore dans Database types (regen requise) → cast minimal
  const client = supabase as unknown as {
    from: (t: string) => {
      upsert: (
        row: Record<string, unknown>,
        opts: { onConflict: string },
      ) => Promise<{ error: { message: string } | null }>
    }
  }

  const { error } = await client.from('user_preferences').upsert(
    {
      user_id: user.id,
      monthly_report_email_enabled: enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) return { error: error.message }

  revalidatePath('/app/account')
  return { success: true }
}

// ============================================
// Paramètres ADEME (profiles.linguistic_profile JSONB)
// ============================================

const ademeSettingsSchema = z.object({
  certificat_rge: z
    .string()
    .trim()
    .max(40)
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null)),
  monitoring_enabled: z.boolean(),
})

/**
 * Met à jour le certificat RGE et le flag monitoring ADEME dans
 * `profiles.linguistic_profile` (JSONB).
 *
 * Convention V1 documentée dans `supabase/functions/ademe-daily-sync/index.ts` :
 * le worker lit `profiles.linguistic_profile.certificat_rge` et ne synchronise
 * que les profils où `linguistic_profile.ademe_monitoring_enabled === true`.
 */
export async function updateAdemeSettingsAction(
  input: { certificat_rge: string | null; monitoring_enabled: boolean },
): Promise<FormState> {
  const parsed = ademeSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  const { supabase, user } = await getCurrentUser()

  // Lit le linguistic_profile actuel pour fusionner les autres clés
  const { data: current } = await supabase
    .from('profiles')
    .select('linguistic_profile')
    .eq('id', user.id)
    .maybeSingle()

  const currentProfile = (current?.linguistic_profile ?? {}) as Record<string, unknown>

  const updatedProfile = {
    ...currentProfile,
    certificat_rge: parsed.data.certificat_rge,
    ademe_monitoring_enabled: parsed.data.monitoring_enabled,
    ademe_monitoring_updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('profiles')
    .update({ linguistic_profile: updatedProfile })
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/app/account')
  return { success: true }
}

// ============================================
// Module add-on trials (essai 14j sans CB)
// ============================================

/**
 * Démarre un essai 14j sur un module add-on.
 *
 * Workflow :
 *   1. Vérifie l'auth user + récupère subscription active
 *   2. Vérifie que le module existe dans addon_modules
 *   3. Insère module_trials (trial_ends_at = now + 14d, status='active')
 *   4. Anti-doublon : si déjà un trial actif sur ce module, retourne erreur lisible
 *
 * Le worker `module-trial-reminders` envoie J+1 / J-5 / J-2 par email.
 * À J14 sans décision → status='expired', accès coupé.
 */
export async function startModuleTrialAction(
  moduleCode: string,
): Promise<FormState> {
  if (!moduleCode || moduleCode.length > 60) {
    return { error: 'Code module invalide' }
  }

  const { supabase, user, orgId } = await getCurrentUser()

  // 1. Subscription active
  const { data: subRow } = (await supabase
    .from('subscriptions')
    .select('id, status')
    .eq('organization_id', orgId)
    .maybeSingle()) as { data: { id: string; status: string } | null }

  if (!subRow || !['trialing', 'active', 'past_due'].includes(subRow.status)) {
    return {
      error:
        'Aucun abonnement actif. Souscrivez à un forfait avant de démarrer un essai module.',
    }
  }

  // 2. Module existe ?
  type AddonRow = { id: string; code: string }
  const { data: moduleRow } = (await (
    supabase as unknown as {
      from: (t: string) => {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            maybeSingle: () => Promise<{ data: AddonRow | null }>
          }
        }
      }
    }
  )
    .from('addon_modules')
    .select('id, code')
    .eq('code', moduleCode)
    .maybeSingle()) as { data: AddonRow | null }

  if (!moduleRow) {
    return { error: 'Module inconnu' }
  }

  // 3. Insère trial (anti-doublon via unique index partiel)
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  const { error: insertError } = (await (
    supabase as unknown as {
      from: (t: string) => {
        insert: (rows: Record<string, unknown>) => Promise<{
          error: { code?: string; message: string } | null
        }>
      }
    }
  )
    .from('module_trials')
    .insert({
      organization_id: orgId,
      user_id: user.id,
      module_id: moduleRow.id,
      subscription_id: subRow.id,
      trial_ends_at: trialEndsAt,
      trial_duration_days: 14,
      status: 'active',
    })) as { error: { code?: string; message: string } | null }

  if (insertError) {
    if (insertError.code === '23505') {
      return { error: 'Un essai est déjà en cours sur ce module' }
    }
    if (
      insertError.code === '42P01' ||
      insertError.message?.includes('does not exist')
    ) {
      return {
        error:
          "Module d'essai indisponible — les essais module seront activés prochainement.",
      }
    }
    return { error: insertError.message }
  }

  revalidatePath('/app/account')
  return { success: true }
}
