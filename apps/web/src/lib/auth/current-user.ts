import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { cache } from 'react'

/**
 * Récupère l'utilisateur courant + son organisation par défaut.
 * Memoized par requête (React cache) pour éviter les round-trips.
 * Redirige vers /login si non authentifié.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, phone, default_org_id, locale')
    .eq('id', user.id)
    .single()

  if (!profile?.default_org_id) {
    throw new Error('Profile or default organization missing — onboarding incomplete')
  }

  return {
    user,
    profile,
    orgId: profile.default_org_id,
    supabase,
  }
})
