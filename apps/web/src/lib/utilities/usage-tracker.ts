/**
 * KOVAS — Tracker d'usage des 5 utilities.
 *
 * Insert async, fire-and-forget. Toute erreur est avalée (on ne casse pas le
 * flow utilisateur si l'INSERT échoue — l'utilitaire reste fonctionnel).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type UtilityKey =
  | 'diagnostic_requirements'
  | 'validity_checker'
  | 'surface_calculator'
  | 'client_template_generator'
  | 'pre_departure_checklist'

interface TrackerArgs {
  // SupabaseClient typé large : on n'a besoin que de .from().insert()
  // et un client Database-typé n'apporte rien ici.
  supabase: SupabaseClient
  userId: string
  organizationId: string | null
  utility: UtilityKey
  context?: Record<string, unknown>
}

/**
 * Insère une trace d'usage. Fire-and-forget — n'attend pas la réponse pour
 * débloquer la route handler.
 */
export function trackUtilityUsage(args: TrackerArgs): void {
  void args.supabase
    .from('utilities_usage')
    .insert({
      user_id: args.userId,
      organization_id: args.organizationId,
      utility: args.utility,
      context: args.context ?? null,
    })
    .then(({ error }) => {
      if (error) {
        // Volontairement silencieux : on logge minimal côté serveur.
        console.warn('[utilities] tracking insert failed:', error.message)
      }
    })
}
