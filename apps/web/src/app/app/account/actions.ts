'use server'

import { getCurrentUser } from '@/lib/auth/current-user'
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type FormState = { error?: string; success?: boolean } | undefined

// ============================================
// Profil utilisateur (table profiles)
// ============================================

const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
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
    full_name: formData.get('full_name'),
    phone: formData.get('phone') ?? '',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  const { supabase, user } = await getCurrentUser()

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name,
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
