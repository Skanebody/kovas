/**
 * KOVAS — Adaptateur IO pour les signaux de disponibilité fiche publique (B42).
 *
 * Extrait de `app/.../[slug]/page.tsx` pour permettre :
 *   - Tests unitaires avec un client Supabase mocké (injection)
 *   - Réutilisation potentielle (cron pré-calcul, admin tooling)
 *
 * Côté SQL : la RPC `get_diagnostician_response_metrics` (Lot B41) calcule la
 * médiane + sample_size côté Postgres. On la consomme ici puis on délègue le
 * formatage à `computeAvailabilitySignals` (pure-fn, B37).
 */

import { type AvailabilitySignals, computeAvailabilitySignals } from './diag-availability'

/**
 * Forme minimale du client Supabase qu'on consomme. Le champ data est typé
 * permissivement car les types DB ne sont pas régénérés pour la nouvelle RPC.
 */
export interface SupabaseRpcClient {
  // biome-ignore lint/suspicious/noExplicitAny: minimal shape, types DB pas régen
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: any; error: unknown }>
}

export interface FetchAvailabilityInput {
  /** ID du diag (uuid) */
  diagnosticianId: string
  /** Fiche diagnosticians — champs `last_verified_at` et `updated_at` */
  diagRow: { last_verified_at?: string | null; updated_at?: string | null }
  /** Client Supabase (injecté pour tests) */
  supabase: SupabaseRpcClient
  /** Date de référence pour les calculs (default: now()) — facilite les tests */
  now?: Date
}

/**
 * Récupère les signaux de disponibilité d'un diag via la RPC SQL B41.
 *
 * Tolérance défensive : si la RPC échoue (migration pas appliquée,
 * permission, transient error), on retourne des signaux avec sample_size=0
 * et la section "Réactivité" sera masquée gracieusement par le UI.
 */
export async function fetchAvailabilitySignals(
  input: FetchAvailabilityInput,
): Promise<AvailabilitySignals> {
  let medianResponseMinutes: number | null = null
  let sampleSize = 0

  try {
    const { data, error } = await input.supabase.rpc('get_diagnostician_response_metrics', {
      p_diagnostician_id: input.diagnosticianId,
    })
    if (!error && Array.isArray(data) && data.length > 0) {
      const row = data[0] as { median_minutes: number | string | null; sample_size: number }
      const median =
        typeof row.median_minutes === 'string'
          ? Number.parseFloat(row.median_minutes)
          : row.median_minutes
      medianResponseMinutes = typeof median === 'number' && Number.isFinite(median) ? median : null
      sampleSize = typeof row.sample_size === 'number' ? row.sample_size : 0
    }
  } catch {
    // RPC absente ou erreur transitoire — défauts neutres
  }

  return computeAvailabilitySignals({
    median_response_minutes: medianResponseMinutes,
    sample_size: sampleSize,
    last_verified_at: input.diagRow.last_verified_at ?? null,
    updated_at: input.diagRow.updated_at ?? null,
    now: input.now,
  })
}
