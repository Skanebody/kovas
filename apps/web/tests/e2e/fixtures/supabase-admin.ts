/**
 * Helpers Supabase admin — création / cleanup users E2E.
 *
 * Utilise SERVICE_ROLE_KEY pour bypass RLS et créer/supprimer les users
 * de test sans friction. À utiliser UNIQUEMENT depuis les tests Playwright.
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  // eslint-disable-next-line no-console
  console.warn(
    '[e2e] NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant — les tests qui créent des users échoueront.',
  )
}

export const adminClient = createClient(
  SUPABASE_URL ?? 'http://localhost:54321',
  SERVICE_ROLE_KEY ?? 'placeholder',
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
)

export interface TestUserCredentials {
  email: string
  password: string
  userId: string
  orgId: string | null
  fullName: string
  siret: string
}

export interface CreateTestUserOptions {
  email?: string
  password?: string
  fullName?: string
  siret?: string
}

/**
 * Crée un user test directement via l'API admin Supabase (bypass signup form).
 * Idéal pour les tests qui ont juste besoin d'un user connecté.
 *
 * @returns credentials utilisables avec loginAs()
 */
export async function createTestUser(
  opts: CreateTestUserOptions = {},
): Promise<TestUserCredentials> {
  const rand = Math.random().toString(36).slice(2, 8)
  const email = opts.email ?? `e2e_test_${Date.now()}_${rand}@example.com`
  const password = opts.password ?? 'TestPass1234!'
  const fullName = opts.fullName ?? 'Test E2E'
  // SIRET de test (nécessite NEXT_PUBLIC_KOVAS_DEV_ALLOW_FAKE_SIRET=1
  // ou un SIRET Luhn-valide réel)
  const siret = opts.siret ?? '12345678900012'

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (error || !data.user) {
    throw new Error(`createTestUser failed: ${error?.message ?? 'unknown error'}`)
  }

  // L'organization est auto-créée par le trigger handle_new_user() (cf. migrations Supabase).
  // On récupère l'orgId depuis profiles si présent.
  let orgId: string | null = null
  const { data: profile } = await adminClient
    .from('profiles')
    .select('default_org_id')
    .eq('id', data.user.id)
    .maybeSingle()
  if (profile?.default_org_id) {
    orgId = profile.default_org_id as string
  }

  return { email, password, userId: data.user.id, orgId, fullName, siret }
}

/**
 * Supprime un user test (cascade via FK sur profiles, organizations, etc.).
 * Best-effort : ne throw pas si user introuvable.
 */
export async function cleanupTestUser(emailOrId: string): Promise<void> {
  try {
    // Si c'est un UUID, delete direct
    if (/^[0-9a-f-]{36}$/i.test(emailOrId)) {
      await adminClient.auth.admin.deleteUser(emailOrId)
      return
    }
    // Sinon, recherche par email
    const { data } = await adminClient.auth.admin.listUsers({ perPage: 200 })
    const target = data?.users.find((u) => u.email === emailOrId)
    if (target) {
      await adminClient.auth.admin.deleteUser(target.id)
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[e2e] cleanupTestUser(${emailOrId}) failed:`, err)
  }
}

/**
 * Nettoie tous les users dont l'email commence par `e2e_test_` (filet de sécurité
 * pour éviter accumulation de comptes orphelins lors d'échecs intermittents).
 */
export async function cleanupAllTestUsers(): Promise<number> {
  const { data } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  const targets = (data?.users ?? []).filter((u) => u.email?.startsWith('e2e_test_'))
  for (const u of targets) {
    await adminClient.auth.admin.deleteUser(u.id).catch(() => {
      /* swallow */
    })
  }
  return targets.length
}
