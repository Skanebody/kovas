import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { type SupabaseClient, createClient } from '@supabase/supabase-js'
import type { Database } from './types'

export type { Database } from './types'
export type KovasSupabaseClient = SupabaseClient<Database>

/**
 * Client navigateur (anon key). Pour usage dans composants React client.
 */
export function createKovasBrowserClient(): SupabaseClient<Database> {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

/**
 * Client serveur (anon key + cookies). Pour usage dans Server Components Next.js.
 * @see https://supabase.com/docs/guides/auth/server-side/nextjs
 */
export function createKovasServerClient(cookies: {
  getAll: () => { name: string; value: string }[]
  setAll: (cookies: { name: string; value: string; options?: Record<string, unknown> }[]) => void
}): SupabaseClient<Database> {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies },
  )
}

/**
 * Client admin (service_role key). BACKEND ONLY. JAMAIS exposer dans le bundle client.
 * À utiliser uniquement dans Edge Functions ou Next.js API routes côté serveur.
 */
export function createKovasAdminClient(): SupabaseClient<Database> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY missing — never expose to client bundle')
  }
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  )
}
