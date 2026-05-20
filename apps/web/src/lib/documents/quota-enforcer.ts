/**
 * KOVAS — Document Intelligence : enforcement quotas mensuels de scans.
 *
 * Authority : CLAUDE.md §4 (pricing) + §5 (UX anti-friction).
 *
 * Comportement :
 *   - Tier Découverte 29€ : 60 scans/mois, dépassement BLOQUANT (UX rappel upgrade).
 *   - Tier Standard 59€ : 300 scans inclus, overage 0,10€/scan, non bloquant.
 *   - Tier Volume 99€  : 1000 scans inclus, overage 0,05€/scan, non bloquant.
 *   - Founder 49€      : 300 scans inclus, overage 0,10€/scan, non bloquant.
 *
 * Reset automatique au passage de mois calendaire (Europe/Paris).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type ScanPlanId = 'decouverte' | 'standard' | 'volume' | 'founder'

export interface ScanPlanConfig {
  included: number
  overagePricePerScan: number | null
  isBlocking: boolean
}

export const SCAN_QUOTAS: Record<ScanPlanId, ScanPlanConfig> = {
  decouverte: { included: 60, overagePricePerScan: null, isBlocking: true },
  standard: { included: 300, overagePricePerScan: 0.1, isBlocking: false },
  volume: { included: 1000, overagePricePerScan: 0.05, isBlocking: false },
  founder: { included: 300, overagePricePerScan: 0.1, isBlocking: false },
}

const DEFAULT_PLAN: ScanPlanId = 'decouverte'

export interface QuotaCheckResult {
  ok: boolean
  remaining?: number
  reason?: string
  used?: number
  included?: number
  planId?: ScanPlanId
}

export interface QuotaRemaining {
  used: number
  included: number
  remaining: number
  planId: ScanPlanId
  overageScans: number
  overageCostEur: number
}

/**
 * Vérifie + incrémente le compteur si quota dispo. Atomique côté serveur.
 *
 * Use case : appelé AVANT classification IA, pour ne pas brûler des tokens
 * Claude alors que le user a atteint son cap bloquant.
 *
 * Returns :
 *   - { ok: true, remaining } si quota disponible ET incrémenté
 *   - { ok: false, reason } si tier bloquant + cap atteint
 *   - { ok: true, reason: 'overage_applied' } si dépassement non bloquant facturé
 */
export async function checkAndDeductQuota(
  userId: string,
  supabase: SupabaseClient,
): Promise<QuotaCheckResult> {
  await maybeResetMonthlyPeriod(userId, supabase)

  const row = await getOrCreateQuotaRow(userId, supabase)
  const planId: ScanPlanId = (row.plan_id as ScanPlanId | null) ?? DEFAULT_PLAN
  const config = SCAN_QUOTAS[planId] ?? SCAN_QUOTAS[DEFAULT_PLAN]

  const used = row.scans_used_this_period as number
  const included = (row.scans_included as number) ?? config.included
  const remaining = Math.max(0, included - used)

  // Cas 1 : sous le quota inclus
  if (used < included) {
    const { error: updErr } = await supabase
      // biome-ignore lint/suspicious/noExplicitAny: types Supabase générés ne reflètent pas encore la nouvelle table user_scan_quotas
      .from('user_scan_quotas' as any)
      .update({ scans_used_this_period: used + 1 })
      .eq('user_id', userId)
    if (updErr) {
      return { ok: false, reason: `Quota update failed: ${updErr.message}` }
    }
    return {
      ok: true,
      remaining: remaining - 1,
      used: used + 1,
      included,
      planId,
    }
  }

  // Cas 2 : quota dépassé + tier bloquant → refus
  if (config.isBlocking) {
    return {
      ok: false,
      reason: `Quota mensuel atteint (${included} scans). Passer au tier Standard pour continuer.`,
      used,
      included,
      planId,
    }
  }

  // Cas 3 : dépassement non bloquant → facturation overage
  const overageScans = (row.overage_scans as number) + 1
  const overagePrice = config.overagePricePerScan ?? 0
  const overageCostEur = Math.round(overageScans * overagePrice * 100) / 100

  const { error: updErr } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: types Supabase générés ne reflètent pas encore la nouvelle table user_scan_quotas
    .from('user_scan_quotas' as any)
    .update({
      scans_used_this_period: used + 1,
      overage_scans: overageScans,
      overage_cost_eur: overageCostEur,
      overage_price_per_scan: overagePrice,
    })
    .eq('user_id', userId)

  if (updErr) {
    return { ok: false, reason: `Overage update failed: ${updErr.message}` }
  }

  return {
    ok: true,
    remaining: 0,
    used: used + 1,
    included,
    planId,
    reason: 'overage_applied',
  }
}

/**
 * Lit le quota courant sans le modifier. Utilisé par le widget transparence.
 */
export async function getQuotaRemaining(
  userId: string,
  supabase: SupabaseClient,
): Promise<QuotaRemaining> {
  await maybeResetMonthlyPeriod(userId, supabase)
  const row = await getOrCreateQuotaRow(userId, supabase)
  const planId: ScanPlanId = (row.plan_id as ScanPlanId | null) ?? DEFAULT_PLAN
  const config = SCAN_QUOTAS[planId] ?? SCAN_QUOTAS[DEFAULT_PLAN]
  const used = row.scans_used_this_period as number
  const included = (row.scans_included as number) ?? config.included
  return {
    used,
    included,
    remaining: Math.max(0, included - used),
    planId,
    overageScans: (row.overage_scans as number) ?? 0,
    overageCostEur: Number(row.overage_cost_eur ?? 0),
  }
}

// ============================================
// Internals
// ============================================

interface QuotaRow {
  user_id: string
  current_period_start: string
  scans_used_this_period: number
  scans_included: number
  overage_scans: number
  overage_cost_eur: number | string
  overage_price_per_scan: number | string | null
  plan_id: string | null
  last_reset_at: string
}

async function getOrCreateQuotaRow(userId: string, supabase: SupabaseClient): Promise<QuotaRow> {
  const { data: existing } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: types Supabase générés ne reflètent pas encore la nouvelle table user_scan_quotas
    .from('user_scan_quotas' as any)
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) return existing as unknown as QuotaRow

  const planId = DEFAULT_PLAN
  const config = SCAN_QUOTAS[planId]
  const insertPayload = {
    user_id: userId,
    scans_included: config.included,
    plan_id: planId,
  }

  const { data: inserted, error: insErr } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: types Supabase générés ne reflètent pas encore la nouvelle table user_scan_quotas
    .from('user_scan_quotas' as any)
    .insert(insertPayload)
    .select('*')
    .single()

  if (insErr || !inserted) {
    throw new Error(`Failed to init user_scan_quotas: ${insErr?.message ?? 'unknown'}`)
  }
  return inserted as unknown as QuotaRow
}

/**
 * Si current_period_start est dans un mois calendaire antérieur (Europe/Paris),
 * reset le compteur. Idempotent — peut être appelé à chaque check.
 */
async function maybeResetMonthlyPeriod(userId: string, supabase: SupabaseClient): Promise<void> {
  const { data: row } = await supabase
    // biome-ignore lint/suspicious/noExplicitAny: types Supabase générés ne reflètent pas encore la nouvelle table user_scan_quotas
    .from('user_scan_quotas' as any)
    .select('current_period_start')
    .eq('user_id', userId)
    .maybeSingle()

  if (!row) return // sera créée par getOrCreateQuotaRow

  const periodStart =
    typeof (row as { current_period_start?: string }).current_period_start === 'string'
      ? new Date((row as { current_period_start: string }).current_period_start)
      : null
  if (!periodStart) return

  const now = new Date()
  const periodMonthKey = `${periodStart.getUTCFullYear()}-${periodStart.getUTCMonth()}`
  const nowMonthKey = `${now.getUTCFullYear()}-${now.getUTCMonth()}`

  if (periodMonthKey === nowMonthKey) return

  // Reset
  await supabase
    // biome-ignore lint/suspicious/noExplicitAny: types Supabase générés ne reflètent pas encore la nouvelle table user_scan_quotas
    .from('user_scan_quotas' as any)
    .update({
      current_period_start: now.toISOString().slice(0, 10),
      scans_used_this_period: 0,
      overage_scans: 0,
      overage_cost_eur: 0,
      last_reset_at: now.toISOString(),
    })
    .eq('user_id', userId)
}
