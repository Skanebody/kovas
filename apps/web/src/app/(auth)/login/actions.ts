'use server'

import { checkRateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, '8 caractères minimum'),
})

export type LoginState = { error?: string } | undefined

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Données invalides' }
  }

  // Rate-limit scopé à l'email (anti credential-stuffing par email)
  // 10 tentatives / 15 min / email. Fail-closed en prod si Upstash absent.
  const rl = await checkRateLimit('auth', `login:${parsed.data.email.toLowerCase()}`)
  if (!rl.success) {
    const retryMinutes = Math.max(1, Math.ceil((rl.reset - Date.now()) / 60_000))
    return {
      error: `Trop de tentatives de connexion. Réessayez dans ${retryMinutes} minute${retryMinutes > 1 ? 's' : ''}.`,
    }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return {
      error:
        error.message === 'Invalid login credentials'
          ? 'Email ou mot de passe incorrect'
          : error.message,
    }
  }

  redirect('/dashboard/dashboard')
}
