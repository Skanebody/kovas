/**
 * Helpers d'observabilité pour les sections admin P1 :
 *   - /admin/email-health
 *   - /admin/performance
 *   - /admin/churn-risk
 *   - /admin/backups (essentiellement statique)
 *
 * Stratégie d'agrégation : identique à ia-analytics.ts — on lit les rows brutes
 * via service_role et on agrège en JS. Volume V1 < 100k rows / mois donc OK.
 * Bascule RPC SQL si latence > 1s.
 */

import type { Database } from '@kovas/database/types'
import type { SupabaseClient } from '@supabase/supabase-js'

// ============================================
// Types row partiels (tables non encore dans Database type généré)
// ============================================

interface EmailEventRow {
  id: string
  message_id: string | null
  recipient: string
  email_type: string | null
  event_type: string
  payload: Record<string, unknown>
  created_at: string
}

interface PerfMetricRow {
  id: string
  operation: string
  duration_ms: number
  status: 'success' | 'error' | 'timeout'
  organization_id: string | null
  error_code: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// Builder typé pour bypass des tables hors types générés.
function rawTable<T>(supabase: SupabaseClient<Database>, table: string) {
  return supabase.from(table) as unknown as {
    select: (columns: string) => {
      gte: (column: string, value: string) => {
        order: (
          column: string,
          opts?: { ascending: boolean },
        ) => {
          limit: (n: number) => Promise<{ data: T[] | null; error: { message: string } | null }>
        }
      }
      order: (
        column: string,
        opts?: { ascending: boolean },
      ) => {
        limit: (n: number) => Promise<{ data: T[] | null; error: { message: string } | null }>
      }
    }
  }
}

// ============================================
// Helpers temps
// ============================================

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

function hoursAgoIso(hours: number): string {
  const d = new Date()
  d.setHours(d.getHours() - hours)
  return d.toISOString()
}

function startOfDayIso(date: Date): string {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy.toISOString()
}

// ============================================
// Email deliverability
// ============================================

export interface EmailDeliveryStats {
  /** Total d'événements `delivered` ou `sent` (numérateur tentatives). */
  sent: number
  delivered: number
  hardBounced: number
  softBounced: number
  complained: number
  unsubscribed: number
  /** delivered / (delivered + hardBounced + softBounced) — exprimé 0..1 */
  deliveryRate: number
  bounceRate: number
  complaintRate: number
}

export interface EmailDeliveryByType {
  type: string
  stats: EmailDeliveryStats
}

export interface EmailBouncingRecipient {
  recipient: string
  bounces: number
  lastBounceAt: string
  lastEventType: string
}

export interface EmailHealthSnapshot {
  global30d: EmailDeliveryStats
  byType: EmailDeliveryByType[]
  topBouncing: EmailBouncingRecipient[]
  /** Série quotidienne 30j — pour graphique line chart */
  daily: Array<{ date: string; delivered: number; bounced: number; complained: number }>
}

function computeStats(events: EmailEventRow[]): EmailDeliveryStats {
  let sent = 0
  let delivered = 0
  let hardBounced = 0
  let softBounced = 0
  let complained = 0
  let unsubscribed = 0

  for (const e of events) {
    switch (e.event_type) {
      case 'sent':
        sent += 1
        break
      case 'delivered':
        delivered += 1
        break
      case 'bounced':
        hardBounced += 1
        break
      case 'soft_bounced':
        softBounced += 1
        break
      case 'complained':
        complained += 1
        break
      case 'unsubscribed':
        unsubscribed += 1
        break
      default:
        break
    }
  }

  const tentatives = delivered + hardBounced + softBounced
  const deliveryRate = tentatives > 0 ? delivered / tentatives : 0
  const bounceRate = tentatives > 0 ? (hardBounced + softBounced) / tentatives : 0
  const complaintRate = delivered > 0 ? complained / delivered : 0

  return {
    sent,
    delivered,
    hardBounced,
    softBounced,
    complained,
    unsubscribed,
    deliveryRate,
    bounceRate,
    complaintRate,
  }
}

export async function getEmailHealth(
  supabase: SupabaseClient<Database>,
): Promise<EmailHealthSnapshot> {
  const since = daysAgoIso(30)
  const { data, error } = await rawTable<EmailEventRow>(supabase, 'email_events')
    .select('id, message_id, recipient, email_type, event_type, payload, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(50000)

  if (error || !data) {
    return {
      global30d: computeStats([]),
      byType: [],
      topBouncing: [],
      daily: [],
    }
  }

  const events = data

  // Global
  const global30d = computeStats(events)

  // Par type
  const byTypeMap = new Map<string, EmailEventRow[]>()
  for (const e of events) {
    const t = e.email_type ?? 'unknown'
    const list = byTypeMap.get(t) ?? []
    list.push(e)
    byTypeMap.set(t, list)
  }
  const byType: EmailDeliveryByType[] = [...byTypeMap.entries()]
    .map(([type, evs]) => ({ type, stats: computeStats(evs) }))
    .sort((a, b) => b.stats.sent + b.stats.delivered - (a.stats.sent + a.stats.delivered))

  // Top 10 bouncing
  const bounceMap = new Map<string, { count: number; lastAt: string; lastEvent: string }>()
  for (const e of events) {
    if (e.event_type !== 'bounced' && e.event_type !== 'soft_bounced') continue
    const entry = bounceMap.get(e.recipient) ?? { count: 0, lastAt: e.created_at, lastEvent: e.event_type }
    entry.count += 1
    if (e.created_at > entry.lastAt) {
      entry.lastAt = e.created_at
      entry.lastEvent = e.event_type
    }
    bounceMap.set(e.recipient, entry)
  }
  const topBouncing: EmailBouncingRecipient[] = [...bounceMap.entries()]
    .map(([recipient, agg]) => ({
      recipient,
      bounces: agg.count,
      lastBounceAt: agg.lastAt,
      lastEventType: agg.lastEvent,
    }))
    .sort((a, b) => b.bounces - a.bounces)
    .slice(0, 10)

  // Série quotidienne 30j
  const dailyMap = new Map<string, { delivered: number; bounced: number; complained: number }>()
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    dailyMap.set(startOfDayIso(d).slice(0, 10), { delivered: 0, bounced: 0, complained: 0 })
  }
  for (const e of events) {
    const day = e.created_at.slice(0, 10)
    const slot = dailyMap.get(day)
    if (!slot) continue
    if (e.event_type === 'delivered') slot.delivered += 1
    else if (e.event_type === 'bounced' || e.event_type === 'soft_bounced') slot.bounced += 1
    else if (e.event_type === 'complained') slot.complained += 1
  }
  const daily = [...dailyMap.entries()].map(([date, agg]) => ({ date, ...agg }))

  return { global30d, byType, topBouncing, daily }
}

// ============================================
// Performance technique
// ============================================

export interface OperationPerf {
  operation: string
  p50ms: number
  p95ms: number
  p99ms: number
  callsCount: number
  errorRate: number
  avgMs: number
}

export interface ErrorRateWindow {
  errors: number
  total: number
  rate: number
}

export interface PerfDailyPoint {
  date: string
  /** p50 toutes opérations confondues */
  p50ms: number
  p95ms: number
  count: number
  errorCount: number
}

export interface PerfSnapshot {
  byOperation: OperationPerf[]
  errors24h: ErrorRateWindow
  errors7d: ErrorRateWindow
  throughputPerMinute24h: number
  daily7d: PerfDailyPoint[]
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length))
  return sorted[idx] ?? 0
}

interface AiUsageRowLite {
  operation: string
  latency_ms: number | null
  cost_eur: number
  created_at: string
}

export async function getPerfSnapshot(
  supabase: SupabaseClient<Database>,
): Promise<PerfSnapshot> {
  const since7d = daysAgoIso(7)
  const since24h = hoursAgoIso(24)

  // 1. Latences IA (ai_usage)
  const { data: aiRows, error: aiErr } = await supabase
    .from('ai_usage')
    .select('operation, latency_ms, cost_eur, created_at')
    .gte('created_at', since7d)

  // 2. Latences non-IA (perf_metrics)
  const { data: perfRows, error: perfErr } = await rawTable<PerfMetricRow>(supabase, 'perf_metrics')
    .select('id, operation, duration_ms, status, organization_id, error_code, metadata, created_at')
    .gte('created_at', since7d)
    .order('created_at', { ascending: false })
    .limit(50000)

  // Normalisation en lignes communes [{ operation, duration_ms, status, created_at }]
  interface Norm {
    operation: string
    duration_ms: number
    status: 'success' | 'error' | 'timeout'
    created_at: string
  }
  const rows: Norm[] = []

  if (!aiErr && aiRows) {
    for (const r of aiRows as AiUsageRowLite[]) {
      if (r.latency_ms === null || r.latency_ms === undefined) continue
      rows.push({
        operation: `ai:${r.operation}`,
        duration_ms: r.latency_ms,
        status: 'success', // pas de status sur ai_usage V1, on assume success
        created_at: r.created_at,
      })
    }
  }
  if (!perfErr && perfRows) {
    for (const r of perfRows) {
      rows.push({
        operation: r.operation,
        duration_ms: r.duration_ms,
        status: r.status,
        created_at: r.created_at,
      })
    }
  }

  // Agrégation par opération
  const byOp = new Map<string, { durs: number[]; errors: number; total: number }>()
  for (const r of rows) {
    const slot = byOp.get(r.operation) ?? { durs: [], errors: 0, total: 0 }
    slot.durs.push(r.duration_ms)
    slot.total += 1
    if (r.status !== 'success') slot.errors += 1
    byOp.set(r.operation, slot)
  }

  const byOperation: OperationPerf[] = [...byOp.entries()]
    .map(([operation, slot]) => {
      const sorted = [...slot.durs].sort((a, b) => a - b)
      const sum = slot.durs.reduce((s, n) => s + n, 0)
      return {
        operation,
        p50ms: percentile(sorted, 0.5),
        p95ms: percentile(sorted, 0.95),
        p99ms: percentile(sorted, 0.99),
        callsCount: slot.total,
        errorRate: slot.total > 0 ? slot.errors / slot.total : 0,
        avgMs: slot.durs.length > 0 ? Math.round(sum / slot.durs.length) : 0,
      }
    })
    .sort((a, b) => b.callsCount - a.callsCount)
    .slice(0, 20)

  // Error rate 24h / 7j (uniquement perf_metrics — ai_usage n'a pas de status)
  const errors24h: ErrorRateWindow = { errors: 0, total: 0, rate: 0 }
  const errors7d: ErrorRateWindow = { errors: 0, total: 0, rate: 0 }
  if (perfRows) {
    for (const r of perfRows) {
      errors7d.total += 1
      if (r.status !== 'success') errors7d.errors += 1
      if (r.created_at >= since24h) {
        errors24h.total += 1
        if (r.status !== 'success') errors24h.errors += 1
      }
    }
    errors24h.rate = errors24h.total > 0 ? errors24h.errors / errors24h.total : 0
    errors7d.rate = errors7d.total > 0 ? errors7d.errors / errors7d.total : 0
  }

  // Throughput 24h : rows / 1440 minutes
  const total24h = rows.filter((r) => r.created_at >= since24h).length
  const throughputPerMinute24h = total24h / 1440

  // Série 7j
  const dailyMap = new Map<string, number[]>()
  const errorMap = new Map<string, number>()
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = startOfDayIso(d).slice(0, 10)
    dailyMap.set(key, [])
    errorMap.set(key, 0)
  }
  for (const r of rows) {
    const day = r.created_at.slice(0, 10)
    const arr = dailyMap.get(day)
    if (!arr) continue
    arr.push(r.duration_ms)
    if (r.status !== 'success') {
      errorMap.set(day, (errorMap.get(day) ?? 0) + 1)
    }
  }
  const daily7d: PerfDailyPoint[] = [...dailyMap.entries()].map(([date, durs]) => {
    const sorted = [...durs].sort((a, b) => a - b)
    return {
      date,
      p50ms: percentile(sorted, 0.5),
      p95ms: percentile(sorted, 0.95),
      count: durs.length,
      errorCount: errorMap.get(date) ?? 0,
    }
  })

  return {
    byOperation,
    errors24h,
    errors7d,
    throughputPerMinute24h,
    daily7d,
  }
}

// ============================================
// Churn risk
// ============================================

export type ChurnRiskLevel = 'high' | 'moderate' | 'low'

export interface ChurnRiskUser {
  userId: string
  email: string
  fullName: string | null
  organizationId: string | null
  organizationName: string | null
  plan: string | null
  /** MRR mensuel risqué — en euros */
  mrrEur: number
  lastMissionAt: string | null
  lastMissionDays: number | null
  lastDossierRef: string | null
  riskLevel: ChurnRiskLevel
  /** Signal déclencheur additionnel — null si juste inactivité */
  triggerSignal: string | null
  /** Tags admin actuels (ex : "à appeler") */
  adminTags: string[]
}

interface SubscriptionRow {
  organization_id: string
  status: string
  tier: string | null
  missions_included: number | null
}

interface OrgRow {
  id: string
  name: string
}

interface MissionRefRow {
  id: string
  organization_id: string
  reference: string
  created_at: string
  status: string
}

interface UserAdminTagRow {
  user_id: string
  tag: string
}

// Source de vérité prix tier — pourrait être centralisée dans lib/stripe-config
// mais ici on duplique pour rester autonome côté admin.
function tierMonthlyEur(tier: string | null): number {
  switch (tier) {
    case 'decouverte':
      return 29
    case 'standard':
      return 59
    case 'standard_founder':
      return 49
    case 'volume':
      return 99
    case 'standard_complet':
      return 99
    case 'volume_complet':
      return 149
    case 'cabinet':
      return 199
    case 'cabinet_founder':
      return 169
    default:
      return 0
  }
}

export async function getChurnRiskUsers(
  supabase: SupabaseClient<Database>,
): Promise<ChurnRiskUser[]> {
  // 1. Toutes les subscriptions actives
  const { data: subs } = await supabase
    .from('subscriptions')
    .select('organization_id, status, tier, missions_included')
    .in('status', ['active', 'trialing', 'past_due'])

  const subsList = (subs ?? []) as SubscriptionRow[]
  if (subsList.length === 0) return []

  const orgIds = subsList.map((s) => s.organization_id)

  // 2. Organisations
  const { data: orgs } = await supabase
    .from('organizations')
    .select('id, name')
    .in('id', orgIds)
  const orgMap = new Map<string, string>()
  for (const o of (orgs ?? []) as OrgRow[]) {
    orgMap.set(o.id, o.name)
  }

  // 3. Profils membres (memberships → profiles)
  //    Stratégie V1 minimale : on prend le profil dont default_org_id == org
  //    (équivalent solopreneur Phase 1, OK pour Cabinet plus tard via memberships).
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name, default_org_id, last_active_at')
    .in('default_org_id', orgIds)
  const profileList = (profiles ?? []) as Array<{
    id: string
    email: string
    full_name: string | null
    default_org_id: string | null
    last_active_at: string | null
  }>

  // 4. Dernière mission par organisation (limit 1 par org via fetch global + group côté JS)
  const since60d = daysAgoIso(60)
  const { data: missions } = await supabase
    .from('missions')
    .select('id, organization_id, reference, created_at, status')
    .in('organization_id', orgIds)
    .gte('created_at', since60d)
    .order('created_at', { ascending: false })
    .limit(2000)

  const lastMissionByOrg = new Map<string, MissionRefRow>()
  for (const m of (missions ?? []) as MissionRefRow[]) {
    if (!lastMissionByOrg.has(m.organization_id)) {
      lastMissionByOrg.set(m.organization_id, m)
    }
  }

  // 5. Admin tags actuels
  const userIds = profileList.map((p) => p.id)
  const tagsMap = new Map<string, string[]>()
  if (userIds.length > 0) {
    const { data: tagsData } = await (
      supabase.from('user_admin_tags') as unknown as {
        select: (cols: string) => {
          in: (col: string, vals: string[]) => Promise<{ data: UserAdminTagRow[] | null }>
        }
      }
    )
      .select('user_id, tag')
      .in('user_id', userIds)
    for (const t of tagsData ?? []) {
      const arr = tagsMap.get(t.user_id) ?? []
      arr.push(t.tag)
      tagsMap.set(t.user_id, arr)
    }
  }

  const now = Date.now()
  const results: ChurnRiskUser[] = []

  for (const sub of subsList) {
    const profile = profileList.find((p) => p.default_org_id === sub.organization_id)
    if (!profile) continue

    const lastMission = lastMissionByOrg.get(sub.organization_id) ?? null
    const lastMissionAt = lastMission?.created_at ?? null
    const lastMissionDays = lastMissionAt
      ? Math.floor((now - new Date(lastMissionAt).getTime()) / (1000 * 60 * 60 * 24))
      : null

    // Critères de risque
    let riskLevel: ChurnRiskLevel | null = null
    if (lastMissionDays === null || lastMissionDays >= 30) riskLevel = 'high'
    else if (lastMissionDays >= 14) riskLevel = 'moderate'
    else if (lastMissionDays >= 7) riskLevel = 'low'

    if (!riskLevel) continue

    // Signal déclencheur
    let triggerSignal: string | null = null
    if (sub.status === 'past_due') triggerSignal = 'Facture impayée (Stripe past_due)'
    else if (sub.status === 'trialing' && (lastMissionDays ?? Infinity) >= 7)
      triggerSignal = 'Essai sans activité depuis 7 jours'

    results.push({
      userId: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      organizationId: sub.organization_id,
      organizationName: orgMap.get(sub.organization_id) ?? null,
      plan: sub.tier,
      mrrEur: tierMonthlyEur(sub.tier),
      lastMissionAt,
      lastMissionDays,
      lastDossierRef: lastMission?.reference ?? null,
      riskLevel,
      triggerSignal,
      adminTags: tagsMap.get(profile.id) ?? [],
    })
  }

  // Tri par MRR risqué desc, puis par risque (high d'abord)
  const riskOrder = { high: 0, moderate: 1, low: 2 } as const
  results.sort((a, b) => {
    if (a.riskLevel !== b.riskLevel) return riskOrder[a.riskLevel] - riskOrder[b.riskLevel]
    return b.mrrEur - a.mrrEur
  })

  return results
}

// ============================================
// Backups PITR (essentiellement statique côté admin)
// ============================================

export interface BackupSnapshotInfo {
  takenAt: string
  /** Indicatif — Supabase ne renvoie pas la taille par snapshot via UI */
  status: 'available' | 'pending'
}

export interface BackupStatus {
  pitrEnabled: boolean
  retentionDays: number
  lastBackupAt: string | null
  rpoMinutes: number | null
  rtoMinutesEstimate: number
  /** Liste indicative — Supabase Management API non câblée V1, on génère la grille des 30 derniers jours */
  snapshots: BackupSnapshotInfo[]
  /** Lien direct dashboard Supabase pour restauration */
  supabaseDashboardUrl: string | null
}

/**
 * V1 — pas d'appel Management API Supabase (API key séparée, configuration M5+).
 * On retourne un statut "informatif" basé sur la config CLAUDE.md §19 + une grille
 * indicative des 30 derniers jours de snapshots quotidiens.
 *
 * V2 — câbler https://api.supabase.com/v1/projects/{ref}/database/backups si
 * souhaité (nécessite SUPABASE_MANAGEMENT_API_KEY).
 */
export function getBackupStatus(): BackupStatus {
  const pitrEnabled = process.env.SUPABASE_PITR_ENABLED === 'true'
  const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1]
  const dashboardUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/database/backups`
    : null

  // PITR Supabase Pro : rétention 7 jours, RPO ~2 minutes, RTO 30 min estimés
  const retentionDays = 7
  const rpoMinutes = pitrEnabled ? 2 : null
  const rtoMinutesEstimate = pitrEnabled ? 30 : 60

  const now = new Date()
  const lastBackupAt = pitrEnabled ? now.toISOString() : null

  const snapshots: BackupSnapshotInfo[] = []
  for (let i = 0; i < 30; i += 1) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    d.setHours(2, 0, 0, 0) // 02:00 UTC — heure standard PITR Supabase
    snapshots.push({
      takenAt: d.toISOString(),
      status: i < retentionDays ? 'available' : 'pending',
    })
  }

  return {
    pitrEnabled,
    retentionDays,
    lastBackupAt,
    rpoMinutes,
    rtoMinutesEstimate,
    snapshots,
    supabaseDashboardUrl: dashboardUrl,
  }
}
