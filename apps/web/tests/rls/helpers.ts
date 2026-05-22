/**
 * Helpers communs aux tests RLS Supabase.
 *
 * Pattern :
 *   - On crée 2 utilisateurs via service-role (admin) avec leurs propres
 *     organisations isolées (handle_new_user trigger).
 *   - Pour CHAQUE test on instancie deux clients anon authentifiés (signIn par
 *     email/password) — userA et userB. Un troisième client reste anonyme.
 *   - On vérifie ensuite que :
 *     * userA voit les rows de son org
 *     * userB ne voit RIEN d'orgA
 *     * anon ne voit RIEN
 *   - Cleanup automatique en afterAll : suppression des deux users (cascade).
 *
 * Si les variables d'env Supabase ne sont pas définies (CI sans secrets,
 * environnement de dev sans projet local lancé), les tests sont skip via
 * `describe.skipIf(!hasSupabaseEnv())`.
 */

import { type SupabaseClient, createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export function hasSupabaseEnv(): boolean {
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) return false
  // On considère "mock-*" comme placeholder du setup vitest → pas un vrai projet
  if (ANON_KEY.startsWith('mock-') || SERVICE_ROLE_KEY.startsWith('mock-')) return false
  const isReachable =
    SUPABASE_URL.includes('localhost') ||
    SUPABASE_URL.includes('127.0.0.1') ||
    SUPABASE_URL.includes('supabase.co') ||
    SUPABASE_URL.includes('supabase.in')
  return isReachable
}

export interface RlsTestUser {
  userId: string
  orgId: string
  email: string
  password: string
  client: SupabaseClient
}

/**
 * Client admin (service role) — bypass RLS, pour setup/cleanup.
 */
export function getAdminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL/SERVICE_ROLE_KEY for RLS tests')
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Client anon non authentifié — pour vérifier le verrou public.
 */
export function getAnonClient(): SupabaseClient {
  if (!SUPABASE_URL || !ANON_KEY) {
    throw new Error('Missing SUPABASE_URL/ANON_KEY for RLS tests')
  }
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Crée un utilisateur de test (admin) puis ouvre un client anon authentifié.
 *
 * @returns user fields + son SupabaseClient anon (avec session)
 */
export async function createRlsTestUser(label: string): Promise<RlsTestUser> {
  const admin = getAdminClient()
  const rand = Math.random().toString(36).slice(2, 8)
  const email = `e2e_rls_${label}_${Date.now()}_${rand}@example-cabinet.fr`
  const password = 'TestPass1234!'

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `RLS ${label}` },
  })

  if (createErr || !created.user) {
    throw new Error(`Failed to create test user ${label}: ${createErr?.message}`)
  }

  // L'organisation est auto-créée via trigger handle_new_user — on la récupère
  const { data: profile } = await admin
    .from('profiles')
    .select('default_org_id')
    .eq('id', created.user.id)
    .maybeSingle()

  const orgId = (profile?.default_org_id as string | undefined) ?? null
  if (!orgId) {
    throw new Error(`No default_org_id found for user ${label} (trigger missing?)`)
  }

  // Client anon authentifié comme cet user
  const client = createClient(SUPABASE_URL ?? '', ANON_KEY ?? '', {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password })
  if (signInErr) {
    throw new Error(`Failed to sign in test user ${label}: ${signInErr.message}`)
  }

  return { userId: created.user.id, orgId, email, password, client }
}

/**
 * Supprime un user test (cascade FK → org, profile, etc.).
 */
export async function cleanupRlsTestUser(userId: string): Promise<void> {
  try {
    const admin = getAdminClient()
    await admin.auth.admin.deleteUser(userId)
  } catch {
    // best-effort
  }
}

/**
 * Helper pour générer une référence de mission unique.
 */
export function makeReference(prefix = 'MIS'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}
