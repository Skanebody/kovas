'use server'

import { joinFullName } from '@/lib/name-utils'
import { checkRateLimit } from '@/lib/rate-limit'
import { isValidReferralCodeFormat } from '@/lib/referral/code-generator'
import { applyReferralOnSignup } from '@/lib/referral/referral-engine'
import { createClient } from '@/lib/supabase/server'
import { getEmailValidationMessage, validateSignupEmail } from '@/lib/validation/email'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const REFERRAL_COOKIE = 'kovas_ref_code'

/**
 * Funnel sans friction (décision Benjamin 2026-05-30) : on ne demande PLUS le
 * SIRET à l'inscription. La vérification SIRENE + l'unicité « 1 SIRET = 1 essai »
 * + l'enregistrement `cabinet_trials` sont déplacés APRÈS le paiement, sur
 * l'écran `/dashboard/account/verify-siret` (protégé par `siret-guard`). On
 * facilite ainsi tout le parcours jusqu'au paiement, puis on exige le SIRET pour
 * activer l'usage.
 */
const signupSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, '8 caractères minimum'),
  firstName: z.string().trim().min(1, 'Prénom requis').max(60),
  lastName: z.string().trim().min(1, 'Nom requis').max(60),
})

export type SignupState =
  | { error?: string; fieldErrors?: Partial<Record<keyof z.infer<typeof signupSchema>, string>> }
  | undefined

export async function signupAction(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
  })

  if (!parsed.success) {
    return {
      error: 'Données invalides',
      fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])),
    }
  }

  // Rate-limit signup permissif (tier `signup` : 30 / 10 min / email).
  const rl = await checkRateLimit('signup', `signup:${parsed.data.email.toLowerCase()}`)
  if (!rl.success) {
    const retryMinutes = Math.max(1, Math.ceil((rl.reset - Date.now()) / 60_000))
    return {
      error: `Trop de tentatives d'inscription. Réessayez dans ${retryMinutes} minute${retryMinutes > 1 ? 's' : ''}.`,
    }
  }

  // Protection légère — on accepte les emails perso (gmail/outlook…) pour ne pas
  // exclure les auto-entrepreneurs ; on bloque seulement le format invalide et
  // les adresses jetables. La légitimité pro est vérifiée via le SIRET (SIRENE)
  // après paiement.
  const emailCheck = validateSignupEmail(parsed.data.email)
  if (!emailCheck.valid) {
    return { fieldErrors: { email: getEmailValidationMessage(emailCheck.reason) } }
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // Recompose `full_name` pour compat schema legacy (cf. profiles trigger).
  const fullName = joinFullName(parsed.data.firstName, parsed.data.lastName)

  // Création user (auto-confirm en V1 — cf. CLAUDE.md §6). Le trigger
  // handle_new_user() crée l'organisation associée (sans SIRET, nullable).
  const { data: createdUser, error: adminError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
    },
  })

  if (adminError || !createdUser?.user) {
    if (adminError?.message?.includes('already')) {
      return { fieldErrors: { email: 'Un compte existe déjà avec cet email.' } }
    }
    return { error: adminError?.message ?? 'Création du compte impossible.' }
  }

  // Programme parrainage : si un code est porté par le cookie ou le formulaire,
  // on enregistre la referral (non bloquant si le code est invalide).
  const formRef = (formData.get('ref') ?? '').toString().trim()
  const cookieStore = await cookies()
  const cookieRef = cookieStore.get(REFERRAL_COOKIE)?.value ?? ''
  const refCandidate = isValidReferralCodeFormat(formRef)
    ? formRef
    : isValidReferralCodeFormat(cookieRef)
      ? cookieRef
      : null

  if (refCandidate) {
    try {
      await applyReferralOnSignup({
        supabase: admin,
        newUserId: createdUser.user.id,
        referralCode: refCandidate,
      })
    } catch (refErr) {
      // Non bloquant — on ne casse pas le signup si la table n'existe pas encore.
      console.warn('referral apply failed:', refErr)
    }
    cookieStore.delete(REFERRAL_COOKIE)
  }

  // Connexion immédiate.
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (signInError) {
    return { error: signInError.message }
  }

  redirect('/dashboard/onboarding')
}
