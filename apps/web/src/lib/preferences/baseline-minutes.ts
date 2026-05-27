/**
 * KOVAS — Helper baseline minutes par mission.
 *
 * Lit la préférence `organizations.baseline_minutes_per_mission` (configurable
 * depuis `/dashboard/account`). Default 90 min (CLAUDE.md §2). Range 15-240
 * enforced côté DB CHECK constraint.
 *
 * Le baseline représente le temps QU'UN DIAGNOSTIQUEUR PASSAIT AVANT KOVAS
 * sur une mission DPE typique (terrain + ressaisie bureau Liciel). Le widget
 * Gain Tracker calcule ensuite : `minutes_saved = baseline × missions_count`.
 *
 * Authority : migration 20260627100000_org_baseline_minutes_per_mission.sql.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Valeur par défaut si la lecture DB échoue ou retourne null. */
export const DEFAULT_BASELINE_MINUTES_PER_MISSION = 90

/** Borne basse acceptable (cap anti-bug). */
export const MIN_BASELINE_MINUTES = 15

/** Borne haute acceptable (4h, cap haut sain). */
export const MAX_BASELINE_MINUTES = 240

/**
 * Lit la préférence `baseline_minutes_per_mission` d'une organisation.
 *
 * Ne throw jamais — en cas d'erreur DB, fallback sur la valeur par défaut.
 */
export async function getOrgBaselineMinutes(
  // biome-ignore lint/suspicious/noExplicitAny: client Supabase typé ou non, signature large
  supabase: SupabaseClient<any, any, any>,
  orgId: string,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('baseline_minutes_per_mission')
      .eq('id', orgId)
      .maybeSingle()
    if (error || !data) return DEFAULT_BASELINE_MINUTES_PER_MISSION
    const value = (data as { baseline_minutes_per_mission: number | null })
      .baseline_minutes_per_mission
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return DEFAULT_BASELINE_MINUTES_PER_MISSION
    }
    return Math.max(MIN_BASELINE_MINUTES, Math.min(MAX_BASELINE_MINUTES, value))
  } catch {
    return DEFAULT_BASELINE_MINUTES_PER_MISSION
  }
}

/**
 * Validation runtime côté server action (avant UPDATE). Throw une erreur
 * lisible si la valeur ne respecte pas les bornes.
 */
export function validateBaselineMinutes(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('Le temps moyen par mission doit être un nombre.')
  }
  const rounded = Math.round(value)
  if (rounded < MIN_BASELINE_MINUTES) {
    throw new Error(
      `Le temps moyen doit être d'au moins ${MIN_BASELINE_MINUTES} minutes par mission.`,
    )
  }
  if (rounded > MAX_BASELINE_MINUTES) {
    throw new Error(
      `Le temps moyen doit être au maximum de ${MAX_BASELINE_MINUTES} minutes par mission (4h).`,
    )
  }
  return rounded
}
