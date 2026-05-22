/**
 * Lecture / écriture des stats bandit dans Supabase.
 * Tous les writes passent par le RPC SECURITY DEFINER `bandit_record_event`
 * pour éviter les race conditions et garantir la cohérence event/stats.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface BanditStatsRow {
  diagnostician_id: string
  impressions: number
  conversions: number
  alpha: number
  beta: number
  last_updated_at: string
  decay_factor: number
  warm_threshold: number
}

export interface ArmStatsRecord {
  armId: string
  stats: { alpha: number; beta: number }
  impressions: number
  warmThreshold: number
}

/**
 * Charge les stats bandit pour une liste de diagnostiqueurs.
 * Les diagnostiqueurs sans stats existantes reçoivent un prior uniforme Beta(1, 1)
 * et impressions=0 (équivalent état initial table).
 */
export async function loadStatsFor(
  supabase: SupabaseClient,
  diagnosticianIds: ReadonlyArray<string>,
): Promise<ArmStatsRecord[]> {
  if (diagnosticianIds.length === 0) return []

  const { data, error } = await supabase
    .from('bandit_diagnostician_stats')
    .select('diagnostician_id, impressions, conversions, alpha, beta, warm_threshold')
    .in('diagnostician_id', [...diagnosticianIds])

  if (error) {
    throw new Error(`loadStatsFor: ${error.message}`)
  }

  const byId = new Map<string, BanditStatsRow>()
  for (const row of (data ?? []) as Pick<
    BanditStatsRow,
    'diagnostician_id' | 'impressions' | 'conversions' | 'alpha' | 'beta' | 'warm_threshold'
  >[]) {
    byId.set(row.diagnostician_id, row as BanditStatsRow)
  }

  return diagnosticianIds.map((id) => {
    const row = byId.get(id)
    return {
      armId: id,
      stats: {
        alpha: row ? Number(row.alpha) : 1,
        beta: row ? Number(row.beta) : 1,
      },
      impressions: row ? row.impressions : 0,
      warmThreshold: row ? row.warm_threshold : 50,
    }
  })
}

/**
 * Enregistre un événement (impression ou conversion) via le RPC atomique.
 */
export async function recordEvent(
  supabase: SupabaseClient,
  params: {
    diagnosticianId: string
    eventType: 'impression' | 'click' | 'lead_request' | 'lead_accepted'
    citySlug?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const { error } = await supabase.rpc('bandit_record_event', {
    p_diagnostician_id: params.diagnosticianId,
    p_event_type: params.eventType,
    p_city_slug: params.citySlug ?? null,
    p_metadata: params.metadata ?? {},
  })
  if (error) {
    throw new Error(`recordEvent (${params.eventType}): ${error.message}`)
  }
}

/**
 * Bulk-record impressions (top 10 affichés) — utilisé après chaque rendu
 * de page annuaire pour alimenter les stats.
 * On itère séquentiellement plutôt que Promise.all pour rester gentil
 * sur la connexion Postgres (rate < 50 req/s acceptable Phase 1).
 */
export async function recordImpressionsBatch(
  supabase: SupabaseClient,
  diagnosticianIds: ReadonlyArray<string>,
  citySlug: string | null,
): Promise<void> {
  for (const id of diagnosticianIds) {
    await recordEvent(supabase, {
      diagnosticianId: id,
      eventType: 'impression',
      citySlug,
    })
  }
}
