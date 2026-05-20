/**
 * Client Supabase service_role pour les requêtes admin (bypass RLS user-scoped).
 *
 * À utiliser UNIQUEMENT côté serveur, dans les routes/pages déjà protégées
 * par verifyAdminAccess() — sinon n'importe quel user pourrait lire toute la DB.
 *
 * Cf. apps/web/src/app/api/calendar/[orgId]/[token].ics/route.ts pour le pattern.
 */

import type { Database } from '@kovas/database/types'
import { type SupabaseClient, createClient } from '@supabase/supabase-js'

export function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'Supabase admin client : NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante.',
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
