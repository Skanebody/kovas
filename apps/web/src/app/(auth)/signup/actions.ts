'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getEmailValidationMessage, validateProEmail } from '@/lib/validation/email'
import {
  getSiretValidationMessage,
  isFakeSiretAllowed,
  validateSiret,
} from '@/lib/validation/siret'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@kovas/database/types'

const signupSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, '8 caractères minimum'),
  fullName: z.string().min(2, 'Nom complet requis').max(80),
  siret: z.string().min(1, 'SIRET requis'),
})

export type SignupState =
  | { error?: string; fieldErrors?: Partial<Record<keyof z.infer<typeof signupSchema>, string>> }
  | undefined

export async function signupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
    siret: formData.get('siret'),
  })

  if (!parsed.success) {
    return {
      error: 'Données invalides',
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((i) => [i.path[0], i.message]),
      ),
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
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
          'Votre cabinet a été suspendu suite à des comportements suspects. Contactez benjamin@kovas.fr.',
      }
    }
    if (existingTrial.converted_to_paid) {
      return {
        error: 'Un compte payant existe déjà pour ce SIRET. Connectez-vous.',
      }
    }
    return {
      error:
        'Votre cabinet a déjà bénéficié d\'un essai KOVAS. Choisissez un abonnement à partir de 29€/mois.',
    }
  }

  // Création user (auto-confirm en V1 dev — cf. CLAUDE.md §6)
  const { data: createdUser, error: adminError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
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

  // Connexion immédiate
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (signInError) {
    return { error: signInError.message }
  }

  redirect('/app/onboarding')
}
