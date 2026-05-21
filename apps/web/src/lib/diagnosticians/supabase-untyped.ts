import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Type pour les requêtes vers les tables qui ne sont pas encore dans le
 * Database type généré (worktrees A1/B2 pas encore mergés au moment où
 * G1 a été développé : diagnosticians, quote_requests, quote_request_unlocks,
 * v_diagnostician_listing_level, city_premium_slots, diagnostician_premium_bookings).
 *
 * À supprimer dès que A1/B2 sont mergés et que `pnpm db:gen-types` est relancé.
 */
export type SupabaseUntyped = SupabaseClient

/**
 * Cast utilitaire — accepte n'importe quel client Supabase typé et le retourne
 * en mode non-paramétré pour les requêtes vers tables non générées.
 *
 * Usage :
 *   const sb = asUntyped(supabase)
 *   await sb.from('diagnosticians').select(...)
 */
export function asUntyped(client: unknown): SupabaseUntyped {
  return client as SupabaseUntyped
}
