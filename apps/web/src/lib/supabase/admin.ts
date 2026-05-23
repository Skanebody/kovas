import type { Database } from '@kovas/database/types'
import { createClient as createAdminClientRaw } from '@supabase/supabase-js'

/**
 * Admin client Supabase (service_role) — bypass des RLS pour Server Actions /
 * Edge Functions internes / cron / Webhooks Stripe.
 *
 * À n'utiliser que côté server (jamais exposer la clé). Lance une erreur claire
 * si les variables d'environnement manquent au lieu de planter à l'usage.
 */
function envOrThrow(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. Configurez .env.local ou Vercel.`,
    )
  }
  return value
}

export function createAdminClient() {
  return createAdminClientRaw<Database>(
    envOrThrow('NEXT_PUBLIC_SUPABASE_URL'),
    envOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/**
 * Variante "loose" — bypass typing pour les tables non-encore régénérées
 * dans `packages/database/src/types.ts` (cf. DEPLOY-4 en pending).
 *
 * À utiliser uniquement pour les tables :
 *  - diagnostician_verification_status
 *  - verification_documents
 *  - verification_checks_log
 *  - verification_alerts_queue
 *  - diagnostician_signalements
 *
 * Une fois DEPLOY-4 fait, ce helper peut être supprimé et `createAdminClient`
 * suffit.
 */
// biome-ignore lint/suspicious/noExplicitAny: Database types pas regenerated yet (DEPLOY-4 pending)
export function createAdminClientLoose(): any {
  return createAdminClient()
}
