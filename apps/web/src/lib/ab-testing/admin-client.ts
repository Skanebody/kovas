import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { AbSupabase } from './assign'
import type { AbDatabase } from './types'

/**
 * Crée un client Supabase en service_role pour les routes API A/B testing.
 * RLS service_role only ⇒ jamais exposer cet appel côté client.
 *
 * Throws si SUPABASE_SERVICE_ROLE_KEY absent (config requise pour mission C2).
 */
export function getAbAdminClient(): AbSupabase {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('A/B testing requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY')
  }
  return createAdminClient<AbDatabase>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
