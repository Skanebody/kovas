/**
 * Decay exponentiel des stats bandit.
 * Appelé par l'Edge Function `bandit-decay` une fois par 24h via cron Supabase.
 *
 * Formule : α ← 1 + (α - 1) × γ   où γ ∈ (0, 1] est le facteur de décroissance.
 *           β ← 1 + (β - 1) × γ
 *
 * Effet :
 *  - γ = 0.95 → half-life ≈ 13.5 jours pour les stats au-delà du prior
 *  - les diagnostiqueurs inactifs retournent doucement vers le prior uniforme
 *  - les nouveaux entrants ne sont jamais écrasés par l'historique ancien
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Applique le decay à un couple (α, β) avec le facteur fourni.
 * Exporté pour tests unitaires.
 */
export function decayBeta(
  alpha: number,
  beta: number,
  decayFactor: number,
): { alpha: number; beta: number } {
  if (decayFactor <= 0 || decayFactor > 1) {
    throw new Error(`decayBeta: factor must be in (0, 1], got ${decayFactor}`)
  }
  return {
    alpha: 1 + Math.max(0, alpha - 1) * decayFactor,
    beta: 1 + Math.max(0, beta - 1) * decayFactor,
  }
}

/**
 * Demi-vie effective d'une déviation au prior, en nombre d'applications.
 * Utilitaire pour tuner γ : demi-vie = log(0.5) / log(γ).
 */
export function halfLife(decayFactor: number): number {
  if (decayFactor <= 0 || decayFactor >= 1) return Number.POSITIVE_INFINITY
  return Math.log(0.5) / Math.log(decayFactor)
}

/**
 * Lance le RPC `bandit_apply_decay` côté Supabase.
 * Retourne le nombre de lignes mises à jour.
 */
export async function applyDecayJob(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc('bandit_apply_decay')
  if (error) {
    throw new Error(`applyDecayJob: ${error.message}`)
  }
  return typeof data === 'number' ? data : 0
}
