'use server'

import { joinFullName } from '@/lib/name-utils'
import { isValidReferralCodeFormat } from '@/lib/referral/code-generator'
import { applyReferralOnSignup } from '@/lib/referral/referral-engine'
import { createClient } from '@/lib/supabase/server'
import { getEmailValidationMessage, validateProEmail } from '@/lib/validation/email'
import {
  getSiretValidationMessage,
  isFakeSiretAllowed,
  validateSiret,
} from '@/lib/validation/siret'
import type { Database } from '@kovas/database/types'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const REFERRAL_COOKIE = 'kovas_ref_code'

const signupSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, '8 caractères minimum'),
  firstName: z.string().trim().min(1, 'Prénom requis').max(60),
  lastName: z.string().trim().min(1, 'Nom requis').max(60),
  siret: z.string().min(1, 'SIRET requis'),
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
    siret: formData.get('siret'),
  })

  if (!parsed.success) {
    return {
      error: 'Données invalides',
      fieldErrors: Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])),
    }
  }

  // Protection 1 — Email pro obligatoire
  const emailCheck = validateProEmail(parsed.data.email)
  if (!emailCheck.valid) {
    return {
      fieldErrors: { email: getEmailValidationMessage(emailCheck.reason) },
    }
  }

  // Protection 2 — Validation SIRET (Luhn, V1 sans INSEE)
  const cleanedSiret = parsed.data.siret.replace(/\s/g, '')
  if (!isFakeSiretAllowed()) {
    const siretCheck = validateSiret(cleanedSiret)
    if (!siretCheck.valid) {
      return {
        fieldErrors: { siret: getSiretValidationMessage(siretCheck.reason) },
      }
    }
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // Protection 3 — 1 SIRET = 1 essai à vie
  const { data: existingTrial } = await admin
    .from('cabinet_trials')
    .select('id, converted_to_paid, blocked_reason')
    .eq('siret', cleanedSiret)
    .maybeSingle()

  if (existingTrial) {
    if (existingTrial.blocked_reason) {
      return {
        error:
          'Votre cabinet a été suspendu suite à des comportements suspects. Contactez contact@kovas.fr.',
      }
    }
    if (existingTrial.converted_to_paid) {
      return {
        error: 'Un compte payant existe déjà pour ce SIRET. Connectez-vous.',
      }
    }
    return {
      error:
        "Votre cabinet a déjà bénéficié d'un essai KOVAS. Choisissez un abonnement à partir de 29€/mois.",
    }
  }

  // Recompose `full_name` pour compat schema legacy (cf. profiles trigger)
  const fullName = joinFullName(parsed.data.firstName, parsed.data.lastName)

  // Création user (auto-confirm en V1 dev — cf. CLAUDE.md §6)
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

  // Récupère l'organization auto-créée par le trigger handle_new_user()
  const { data: profile } = await admin
    .from('profiles')
    .select('default_org_id')
    .eq('id', createdUser.user.id)
    .single()

  // Enregistre le trial dans cabinet_trials
  const { error: trialError } = await admin.from('cabinet_trials').insert({
    siret: cleanedSiret,
    email: parsed.data.email,
    user_id: createdUser.user.id,
    organization_id: profile?.default_org_id ?? null,
  })

  if (trialError && !trialError.message.includes('duplicate')) {
    // Non bloquant en V1 — log et continue
    console.error('cabinet_trials insert failed:', trialError)
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
      // Non bloquant — on ne casse pas le signup si la table n'existe pas encore
      console.warn('referral apply failed:', refErr)
    }
    cookieStore.delete(REFERRAL_COOKIE)
  }

  // Connexion immédiate
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
