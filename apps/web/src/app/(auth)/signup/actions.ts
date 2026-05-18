'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const signupSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, '8 caractères minimum'),
  fullName: z.string().min(2, 'Nom complet requis').max(80),
})

export type SignupState = { error?: string; success?: boolean } | undefined

export async function signupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const parsed = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  // Phase 1 dev : signup via admin endpoint (service_role) avec email_confirm: true
  // pour éviter de dépendre de la config SMTP Supabase (plafonnée à 4 mails/h sur le
  // SMTP par défaut, et Resend custom pas encore configuré).
  // V2 (avant beta publique) : switch vers supabase.auth.signUp() + Resend SMTP custom
  // + email confirmation activé pour validation domaine pro.
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data: createdUser, error: adminError } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  })

  if (adminError || !createdUser?.user) {
    if (adminError?.message?.includes('already')) {
      return { error: 'Un compte existe déjà avec cet email.' }
    }
    return { error: adminError?.message ?? 'Création du compte impossible.' }
  }

  // Connexion immédiate via password (établit la session côté browser via cookies)
  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (signInError) {
    return { error: signInError.message }
  }

  redirect('/app/dashboard')
}
