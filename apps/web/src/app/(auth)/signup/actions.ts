'use server'

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

  const supabase = await createClient()
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${origin}/api/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  // Si confirmations email désactivées (Supabase Studio Auth settings) → user connecté direct.
  if (data.session) {
    redirect('/app/dashboard')
  }

  // Sinon : email de confirmation envoyé.
  return { success: true }
}
