/**
 * Analytics agrégées sur la table `ai_usage` pour la page /admin/cout-ia.
 *
 * Stratégie V1 : les agrégations SUM/GROUP BY/percentile_cont ne sont pas
 * exposées directement par le client JS Supabase. On utilise donc le client
 * service_role (createAdminClient) pour lire les rows brutes du mois en cours
 * puis on agrège en JS. Acceptable tant que le volume ai_usage mensuel reste
 * modéré (< 100k rows). En V2, basculer vers RPC SQL si latence > 1s.
 *
 * Toutes les fonctions retournent des valeurs neutres (0, []) si la table est
 * vide ou si une erreur transient se produit — la page reste affichable même
 * en cas de souci data layer.
 */

import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// Types row partiels (on ne sélectionne que ce dont on a besoin)
// ============================================

interface OrgNameRow {
  id: string
  name: string
}

interface CapRow {
  organization_id: string
  monthly_cap_eur: number | null
  updated_at: string
}

// ============================================
// Public API
// ============================================

export interface IAUsageTodayResult {
  costEur: number
  callsCount: number
  avgLatencyMs: number
}

export interface IAUsageMonthResult {
  costEur: number
  callsCount: number
  byOperation: Record<string, { cost: number; calls: number }>
}

export interface TopConsumer {
  orgId: string
  orgName: string
  costEur: number
  callsCount: number
  percentOfTotal: number
}

export interface AnomalyConsumer {
  orgId: string
  orgName: string
  costLast24h: number
  avg30dDaily: number
  multiplier: number
}

export interface ModelBreakdownEntry {
  model: string
  costEur: number
  callsCount: number
  percentOfTotal: number
}

export interface CacheHitRateResult {
  rate30d: number
  rate7d: number
  trend: 'up' | 'down' | 'stable'
}

export interface LatencyPercentilesResult {
  p50ms: number
  p95ms: number
}

export interface ActiveCap {
  orgId: string
  orgName: string
  monthlyCapEur: number
  lastModifiedIso: string
}

// ============================================
// Helpers temps
// ============================================

function startOfTodayParisIso(): string {
  const now = new Date()
  const parisStr = now.toLocaleString('en-US', { timeZone: 'Europe/Paris' })
  const paris = new Date(parisStr)
  paris.setHours(0, 0, 0, 0)
  return paris.toISOString()
}

function startOfThisMonthIso(): string {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'string' ? Number.parseFloat(v) : v
  return Number.isFinite(n) ? n : 0
}

// ============================================
// 1. Coûts aujourd'hui
// ============================================

export async function getIAUsageToday(
  supabase: SupabaseClient<Database>,
): Promise<IAUsageTodayResult> {
  const sinceIso = startOfTodayParisIso()
  const { data, error } = await supabase
    .from('ai_usage')
    .select('cost_eur, latency_ms')
    .gte('created_at', sinceIso)

  if (error || !data) return { costEur: 0, callsCount: 0, avgLatencyMs: 0 }

  let costEur = 0
  let latencySum = 0
  let latencyCount = 0
  for (const row of data) {
    costEur += toNumber(row.cost_eur)
    if (row.latency_ms !== null && row.latency_ms !== undefined) {
      latencySum += row.latency_ms
      latencyCount += 1
    }
  }
  return {
    costEur,
    callsCount: data.length,
    avgLatencyMs: latencyCount > 0 ? Math.round(latencySum / latencyCount) : 0,
  }
}

// ============================================
// 2. Coûts ce mois (avec breakdown par operation)
// ============================================

export async function getIAUsageMonth(
  supabase: SupabaseClient<Database>,
): Promise<IAUsageMonthResult> {
  const sinceIso = startOfThisMonthIso()
  const { data, error } = await supabase
    .from('ai_usage')
    .select('cost_eur, operation')
    .gte('created_at', sinceIso)

  if (error || !data) return { costEur: 0, callsCount: 0, byOperation: {} }

  let costEur = 0
  const byOperation: Record<string, { cost: number; calls: number }> = {}
  for (const row of data) {
    const c = toNumber(row.cost_eur)
    costEur += c
    const op = row.operation ?? 'unknown'
    const entry = byOperation[op] ?? { cost: 0, calls: 0 }
    entry.cost += c
    entry.calls += 1
    byOperation[op] = entry
  }
  return { costEur, callsCount: data.length, byOperation }
}

// ============================================
// 3. Top consumers ce mois
// ============================================

async function fetchOrgNames(
  supabase: SupabaseClient<Database>,
  orgIds: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (orgIds.length === 0) return names
  const { data } = await supabase.from('organizations').select('id, name').in('id', orgIds)
  for (const o of (data ?? []) as OrgNameRow[]) {
    names.set(o.id, o.name)
  }
  return names
}

export async function getTopConsumers(
  supabase: SupabaseClient<Database>,
  limit = 10,
): Promise<TopConsumer[]> {
  const sinceIso = startOfThisMonthIso()
  const { data, error } = await supabase
    .from('ai_usage')
    .select('organization_id, cost_eur')
    .gte('created_at', sinceIso)
    .not('organization_id', 'is', null)

  if (error || !data) return []

  // Agrégation par org
  const byOrg = new Map<string, { cost: number; calls: number }>()
  let total = 0
  for (const row of data) {
    if (!row.organization_id) continue
    const c = toNumber(row.cost_eur)
    total += c
    const entry = byOrg.get(row.organization_id) ?? { cost: 0, calls: 0 }
    entry.cost += c
    entry.calls += 1
    byOrg.set(row.organization_id, entry)
  }

  const sorted = [...byOrg.entries()].sort((a, b) => b[1].cost - a[1].cost).slice(0, limit)

  const names = await fetchOrgNames(
    supabase,
    sorted.map(([id]) => id),
  )

  return sorted.map(([orgId, agg]) => ({
    orgId,
    orgName: names.get(orgId) ?? '(organisation supprimée)',
    costEur: agg.cost,
    callsCount: agg.calls,
    percentOfTotal: total > 0 ? (agg.cost / total) * 100 : 0,
  }))
}

// ============================================
// 4. Anomaly consumers (> 3x leur moyenne 30j sur les 24 dernières heures)
// ============================================

export async function getAnomalyConsumers(
  supabase: SupabaseClient<Database>,
): Promise<AnomalyConsumer[]> {
  const since30dIso = daysAgoIso(30)
  const since24hIso = daysAgoIso(1)

  const { data, error } = await supabase
    .from('ai_usage')
    .select('organization_id, cost_eur, created_at')
    .gte('created_at', since30dIso)
    .not('organization_id', 'is', null)

  if (error || !data) return []

  // Pour chaque org : cost last 24h + moyenne journalière 30j (excluant 24h)
  const last24h = new Map<string, number>()
  const prior29d = new Map<string, number>()
  for (const row of data) {
    if (!row.organization_id) continue
    const c = toNumber(row.cost_eur)
    if (row.created_at >= since24hIso) {
      last24h.set(row.organization_id, (last24h.get(row.organization_id) ?? 0) + c)
    } else {
      prior29d.set(row.organization_id, (prior29d.get(row.organization_id) ?? 0) + c)
    }
  }

  const anomalies: Array<{
    orgId: string
    costLast24h: number
    avg30dDaily: number
    multiplier: number
  }> = []
  for (const [orgId, cost24h] of last24h) {
    const avg29d = (prior29d.get(orgId) ?? 0) / 29
    // Seuil bruit : on ignore les très petits dépassements (< 0,10€ sur 24h)
    if (cost24h < 0.1) continue
    if (avg29d === 0) {
      // Nouvelle activité : on flag si cost24h > 1€ (signal)
      if (cost24h > 1)
        anomalies.push({
          orgId,
          costLast24h: cost24h,
          avg30dDaily: 0,
          multiplier: Number.POSITIVE_INFINITY,
        })
      continue
    }
    const ratio = cost24h / avg29d
    if (ratio >= 3) {
      anomalies.push({
        orgId,
        costLast24h: cost24h,
        avg30dDaily: avg29d,
        multiplier: ratio,
      })
    }
  }

  // Tri par cost24h descendant
  anomalies.sort((a, b) => b.costLast24h - a.costLast24h)

  const names = await fetchOrgNames(
    supabase,
    anomalies.map((a) => a.orgId),
  )

  return anomalies.map((a) => ({
    orgId: a.orgId,
    orgName: names.get(a.orgId) ?? '(organisation supprimée)',
    costLast24h: a.costLast24h,
    avg30dDaily: a.avg30dDaily,
    multiplier: a.multiplier,
  }))
}

// ============================================
// 5. Breakdown par modèle (ce mois)
// ============================================

export async function getModelBreakdown(
  supabase: SupabaseClient<Database>,
): Promise<ModelBreakdownEntry[]> {
  const sinceIso = startOfThisMonthIso()
  const { data, error } = await supabase
    .from('ai_usage')
    .select('model, cost_eur')
    .gte('created_at', sinceIso)

  if (error || !data) return []

  const byModel = new Map<string, { cost: number; calls: number }>()
  let total = 0
  for (const row of data) {
    const c = toNumber(row.cost_eur)
    total += c
    const entry = byModel.get(row.model) ?? { cost: 0, calls: 0 }
    entry.cost += c
    entry.calls += 1
    byModel.set(row.model, entry)
  }

  return [...byModel.entries()]
    .map(([model, agg]) => ({
      model,
      costEur: agg.cost,
      callsCount: agg.calls,
      percentOfTotal: total > 0 ? (agg.cost / total) * 100 : 0,
    }))
    .sort((a, b) => b.costEur - a.costEur)
}

// ============================================
// 6. Cache hit rate (30j vs 7j)
// ============================================

export async function getCacheHitRate(
  supabase: SupabaseClient<Database>,
): Promise<CacheHitRateResult> {
  const since30dIso = daysAgoIso(30)
  const since7dIso = daysAgoIso(7)

  const { data, error } = await supabase
    .from('ai_usage')
    .select('input_tokens, cached_tokens, created_at')
    .gte('created_at', since30dIso)
    .not('input_tokens', 'is', null)

  if (error || !data) return { rate30d: 0, rate7d: 0, trend: 'stable' }

  let in30 = 0
  let cached30 = 0
  let in7 = 0
  let cached7 = 0
  for (const row of data) {
    const inT = row.input_tokens ?? 0
    const cT = row.cached_tokens ?? 0
    in30 += inT
    cached30 += cT
    if (row.created_at >= since7dIso) {
      in7 += inT
      cached7 += cT
    }
  }

  const rate30d = in30 > 0 ? cached30 / in30 : 0
  const rate7d = in7 > 0 ? cached7 / in7 : 0
  const delta = rate7d - rate30d
  // Seuil de bruit : 1 point de % d'écart pour parler de tendance
  let trend: 'up' | 'down' | 'stable' = 'stable'
  if (delta > 0.01) trend = 'up'
  else if (delta < -0.01) trend = 'down'

  return { rate30d, rate7d, trend }
}

// ============================================
// 7. Latence p50 / p95 (ce mois)
// ============================================

export async function getLatencyPercentiles(
  supabase: SupabaseClient<Database>,
): Promise<LatencyPercentilesResult> {
  const sinceIso = startOfThisMonthIso()
  const { data, error } = await supabase
    .from('ai_usage')
    .select('latency_ms')
    .gte('created_at', sinceIso)
    .not('latency_ms', 'is', null)

  if (error || !data || data.length === 0) return { p50ms: 0, p95ms: 0 }

  const sorted = data
    .map((r) => r.latency_ms ?? 0)
    .filter((n) => n > 0)
    .sort((a, b) => a - b)

  if (sorted.length === 0) return { p50ms: 0, p95ms: 0 }

  const p = (q: number): number => {
    const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length))
    return sorted[idx] ?? 0
  }
  return { p50ms: p(0.5), p95ms: p(0.95) }
}

// ============================================
// 8. Caps personnalisés actifs
// ============================================

export async function getActiveCaps(
  supabase: SupabaseClient<Database>,
  limit = 50,
): Promise<ActiveCap[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('organization_id, monthly_cap_eur, updated_at')
    .not('monthly_cap_eur', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (error || !data) return []
  const rows = data as CapRow[]

  const names = await fetchOrgNames(
    supabase,
    rows.map((r) => r.organization_id),
  )

  return rows
    .filter((r): r is CapRow & { monthly_cap_eur: number } => r.monthly_cap_eur !== null)
    .map((r) => ({
      orgId: r.organization_id,
      orgName: names.get(r.organization_id) ?? '(organisation supprimée)',
      monthlyCapEur: r.monthly_cap_eur,
      lastModifiedIso: r.updated_at,
    }))
}
