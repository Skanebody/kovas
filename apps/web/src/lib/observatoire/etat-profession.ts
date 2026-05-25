/**
 * KOVAS — Helpers d'accès aux statistiques publiques "État de la profession"
 * (Game Changer 4 acqui-target, REFONTE-ACQUI-TARGET-V2 §6.4).
 *
 * Consomme les vues SQL `v_etat_profession_summary` et `v_etat_profession_by_dept`.
 * Données 100% agrégées : aucune PII, exposition anon OK.
 */

import { createClient } from '@/lib/supabase/server'

export interface EtatProfessionSummary {
  readonly total: number
  readonly verified: number
  readonly unverified: number
  readonly pending: number
  readonly suspended: number
  readonly ceased: number
  readonly withSirene: number
  readonly sireneActive: number
  readonly sireneClosed: number
  readonly veryActive: number
  readonly moderatelyActive: number
  readonly lowActivity: number
  readonly claimed: number
  readonly unclaimed: number
  readonly withFraudFlags: number
  readonly lastDhupSyncAt: string | null
  readonly dhupSyncedLast7d: number
}

export interface EtatProfessionByDept {
  readonly departmentCode: string
  readonly totalCount: number
  readonly verifiedCount: number
  readonly sireneActiveCount: number
  readonly veryActiveCount: number
  readonly claimedCount: number
  readonly avgActivityScore: number | null
}

interface SummaryRow {
  total_diagnosticians: number
  verified_count: number
  unverified_count: number
  pending_count: number
  suspended_count: number
  ceased_count: number
  with_sirene_count: number
  sirene_active_count: number
  sirene_closed_count: number
  very_active_count: number
  moderately_active_count: number
  low_activity_count: number
  claimed_count: number
  unclaimed_count: number
  with_fraud_flags_count: number
  last_dhup_sync_at: string | null
  dhup_synced_last_7d_count: number
}

interface DeptRow {
  department_code: string
  total_count: number
  verified_count: number
  sirene_active_count: number
  very_active_count: number
  claimed_count: number
  avg_activity_score: number | string | null
}

const EMPTY_SUMMARY: EtatProfessionSummary = {
  total: 0,
  verified: 0,
  unverified: 0,
  pending: 0,
  suspended: 0,
  ceased: 0,
  withSirene: 0,
  sireneActive: 0,
  sireneClosed: 0,
  veryActive: 0,
  moderatelyActive: 0,
  lowActivity: 0,
  claimed: 0,
  unclaimed: 0,
  withFraudFlags: 0,
  lastDhupSyncAt: null,
  dhupSyncedLast7d: 0,
}

export async function getEtatProfessionSummary(): Promise<EtatProfessionSummary> {
  const supabase = await createClient()
  // biome-ignore lint/suspicious/noExplicitAny: vue pas dans Database.types
  const { data, error } = await (supabase as any)
    .from('v_etat_profession_summary')
    .select('*')
    .maybeSingle()

  if (error || !data) {
    console.warn('getEtatProfessionSummary fallback empty:', error?.message)
    return EMPTY_SUMMARY
  }

  const row = data as SummaryRow
  return {
    total: row.total_diagnosticians ?? 0,
    verified: row.verified_count ?? 0,
    unverified: row.unverified_count ?? 0,
    pending: row.pending_count ?? 0,
    suspended: row.suspended_count ?? 0,
    ceased: row.ceased_count ?? 0,
    withSirene: row.with_sirene_count ?? 0,
    sireneActive: row.sirene_active_count ?? 0,
    sireneClosed: row.sirene_closed_count ?? 0,
    veryActive: row.very_active_count ?? 0,
    moderatelyActive: row.moderately_active_count ?? 0,
    lowActivity: row.low_activity_count ?? 0,
    claimed: row.claimed_count ?? 0,
    unclaimed: row.unclaimed_count ?? 0,
    withFraudFlags: row.with_fraud_flags_count ?? 0,
    lastDhupSyncAt: row.last_dhup_sync_at ?? null,
    dhupSyncedLast7d: row.dhup_synced_last_7d_count ?? 0,
  }
}

export async function getEtatProfessionTopDepts(limit = 10): Promise<EtatProfessionByDept[]> {
  const supabase = await createClient()
  // biome-ignore lint/suspicious/noExplicitAny: vue pas dans Database.types
  const { data, error } = await (supabase as any)
    .from('v_etat_profession_by_dept')
    .select('*')
    .order('total_count', { ascending: false })
    .limit(limit)

  if (error || !data) {
    console.warn('getEtatProfessionTopDepts fallback empty:', error?.message)
    return []
  }

  return (data as DeptRow[]).map((r) => ({
    departmentCode: r.department_code,
    totalCount: r.total_count ?? 0,
    verifiedCount: r.verified_count ?? 0,
    sireneActiveCount: r.sirene_active_count ?? 0,
    veryActiveCount: r.very_active_count ?? 0,
    claimedCount: r.claimed_count ?? 0,
    avgActivityScore:
      r.avg_activity_score == null
        ? null
        : typeof r.avg_activity_score === 'string'
          ? Number.parseFloat(r.avg_activity_score)
          : r.avg_activity_score,
  }))
}

/**
 * Calcule les ratios % à partir d'un summary, en évitant la division par zéro.
 */
export function computeRatios(summary: EtatProfessionSummary): {
  verifiedPct: number
  sireneActivePct: number
  veryActivePct: number
  claimedPct: number
  withFraudFlagsPct: number
} {
  const total = Math.max(1, summary.total)
  return {
    verifiedPct: Math.round((summary.verified / total) * 100),
    sireneActivePct: Math.round((summary.sireneActive / total) * 100),
    veryActivePct: Math.round((summary.veryActive / total) * 100),
    claimedPct: Math.round((summary.claimed / total) * 100),
    withFraudFlagsPct: Math.round((summary.withFraudFlags / total) * 100),
  }
}
