/**
 * KOVAS — Helpers admin pour la page /admin/signup-anomalies.
 *
 * Lit `cabinet_trials` filtré sur `signup_anomaly IS NOT NULL` pour permettre
 * à Benjamin de valider manuellement les cabinets dont le NAF déclaré n'est
 * pas dans le périmètre diagnostic immobilier (71.20B / 71.12B).
 *
 * Cas typique : nouveau cabinet récemment immatriculé pas encore catégorisé
 * SIRENE, ou cabinet multi-activités enregistré sous un code générique.
 *
 * Authority : CLAUDE.md §6.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface SignupAnomalyRow {
  id: string
  siret: string
  email: string
  user_id: string | null
  signupAnomaly: string | null
  sireneVerifiedNaf: string | null
  sireneCompanyName: string | null
  createdAt: string
  bloked: boolean
}

/**
 * Liste les inscriptions flaguées en anomalie (NAF mismatch ou autre).
 * Triée par date d'inscription décroissante.
 */
export async function fetchSignupAnomalies(
  // biome-ignore lint/suspicious/noExplicitAny: Supabase générique
  supabase: SupabaseClient<any, any, any>,
  limit = 200,
): Promise<SignupAnomalyRow[]> {
  // biome-ignore lint/suspicious/noExplicitAny: types DB pas régénérés (migration 20260620300000)
  const { data, error } = await (supabase as any)
    .from('cabinet_trials')
    .select(
      'id, siret, email, user_id, signup_anomaly, sirene_verified_naf, sirene_company_name, created_at, blocked_reason',
    )
    .not('signup_anomaly', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []

  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    siret: String(r.siret),
    email: String(r.email),
    user_id: r.user_id ? String(r.user_id) : null,
    signupAnomaly: r.signup_anomaly ? String(r.signup_anomaly) : null,
    sireneVerifiedNaf: r.sirene_verified_naf ? String(r.sirene_verified_naf) : null,
    sireneCompanyName: r.sirene_company_name ? String(r.sirene_company_name) : null,
    createdAt: String(r.created_at),
    bloked: Boolean(r.blocked_reason),
  }))
}

/**
 * Approuve un signup en anomalie : retire le flag `signup_anomaly`.
 * Le cabinet continue son essai normalement.
 */
export async function approveAnomaly(
  // biome-ignore lint/suspicious/noExplicitAny: Supabase générique
  supabase: SupabaseClient<any, any, any>,
  trialId: string,
): Promise<{ ok: boolean; error?: string }> {
  // biome-ignore lint/suspicious/noExplicitAny: colonnes pas typées
  const { error } = await (supabase as any)
    .from('cabinet_trials')
    .update({ signup_anomaly: null })
    .eq('id', trialId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Rejette un signup en anomalie : bloque le cabinet via `blocked_reason`.
 * Cf. cabinet_trials.blocked_reason : 'siret_naf_invalid' (manual_block alt).
 */
export async function rejectAnomaly(
  // biome-ignore lint/suspicious/noExplicitAny: Supabase générique
  supabase: SupabaseClient<any, any, any>,
  trialId: string,
): Promise<{ ok: boolean; error?: string }> {
  // biome-ignore lint/suspicious/noExplicitAny: colonnes pas typées
  const { error } = await (supabase as any)
    .from('cabinet_trials')
    .update({
      blocked_reason: 'siret_naf_invalid',
      signup_anomaly: null,
    })
    .eq('id', trialId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
