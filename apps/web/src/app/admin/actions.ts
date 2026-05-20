'use server'

import { TWO_FA_COOKIE_NAME } from '@/lib/admin/2fa-cookie'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

/**
 * Déconnexion admin :
 *  - clear cookie 2FA
 *  - supabase.auth.signOut (révoque la session)
 *  - redirect /login
 */
export async function adminLogoutAction() {
  const cookieStore = await cookies()
  cookieStore.delete(TWO_FA_COOKIE_NAME)
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
